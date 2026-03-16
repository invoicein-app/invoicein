/**
 * Billing-admin-only: extend subscription by 1 month for an org identified by org_code.
 * Body: { org_code: string }. Use after manual payment verification.
 * Access gated via lib/billing-admin (MVP: env allowlist; future: role-based).
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getBillingAdminAuth } from "@/lib/billing-admin";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const auth = await getBillingAdminAuth(cookieStore);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const orgCode = String(body?.org_code || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!orgCode) {
    return NextResponse.json({ error: "org_code wajib diisi." }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY belum di-set" }, { status: 500 });
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, org_code, name, expires_at")
    .eq("org_code", orgCode)
    .maybeSingle();

  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 400 });
  if (!org) return NextResponse.json({ error: "Organisasi dengan kode tersebut tidak ditemukan." }, { status: 404 });

  const now = new Date();
  const current = (org as any).expires_at ? new Date((org as any).expires_at) : null;
  const base = current && current > now ? current : now;
  const next = new Date(base);
  next.setMonth(next.getMonth() + 1);

  const { error: upErr } = await admin
    .from("organizations")
    .update({
      subscription_status: "active",
      expires_at: next.toISOString(),
    })
    .eq("id", org.id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    org_id: org.id,
    org_code: (org as any).org_code,
    name: (org as any).name,
    expires_at: next.toISOString(),
  });
}
