/**
 * Billing admin: search org by org_code (GET), update org subscription (PATCH).
 * Access gated via lib/billing-admin (MVP: env allowlist; future: role-based).
 * Uses service role for read/update any org.
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getBillingAdminAuth } from "@/lib/billing-admin";

export async function GET(req: NextRequest) {
  const csAny: any = cookies() as any;
  const cookieStore = csAny?.then ? await csAny : csAny;
  const auth = await getBillingAdminAuth(cookieStore);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const orgCode = req.nextUrl.searchParams.get("org_code")?.trim().toUpperCase().replace(/\s+/g, "") ?? "";
  if (!orgCode) return NextResponse.json({ error: "org_code wajib diisi." }, { status: 400 });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY belum di-set" }, { status: 500 });
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: org, error } = await admin
    .from("organizations")
    .select("id, name, org_code, subscription_status, subscription_plan, trial_ends_at, expires_at, subscription_started_at")
    .eq("org_code", orgCode)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!org) return NextResponse.json({ error: "Organisasi dengan kode tersebut tidak ditemukan." }, { status: 404 });

  return NextResponse.json({ org }, { status: 200 });
}

export async function PATCH(req: NextRequest) {
  const csAny: any = cookies() as any;
  const cookieStore = csAny?.then ? await csAny : csAny;
  const auth = await getBillingAdminAuth(cookieStore);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const orgId = body?.org_id ?? "";
  if (!orgId) return NextResponse.json({ error: "org_id wajib diisi." }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (body.subscription_plan !== undefined) {
    const v = String(body.subscription_plan).toLowerCase();
    if (v === "basic" || v === "standard") updates.subscription_plan = v;
  }
  if (body.subscription_status !== undefined) {
    const v = String(body.subscription_status).toLowerCase();
    if (["trial", "active", "grace_period", "expired", "cancelled"].includes(v)) updates.subscription_status = v;
  }
  if (body.expires_at !== undefined) {
    const v = body.expires_at === null || body.expires_at === "" ? null : String(body.expires_at);
    updates.expires_at = v;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Tidak ada field yang di-update." }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY belum di-set" }, { status: 500 });
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: orgBefore, error: fetchErr } = await admin
    .from("organizations")
    .select("org_code, subscription_plan, expires_at")
    .eq("id", orgId)
    .single();

  if (fetchErr || !orgBefore) {
    return NextResponse.json({ error: fetchErr?.message || "Organisasi tidak ditemukan." }, { status: 400 });
  }

  const { data: org, error: upErr } = await admin
    .from("organizations")
    .update(updates)
    .eq("id", orgId)
    .select("id, name, org_code, subscription_status, subscription_plan, trial_ends_at, expires_at")
    .single();

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  const newPlan = (updates.subscription_plan as string) ?? orgBefore.subscription_plan ?? null;
  const newExpires = updates.expires_at !== undefined ? (updates.expires_at as string | null) : (orgBefore.expires_at ?? null);
  await admin.from("subscription_history").insert({
    org_id: orgId,
    org_code: (orgBefore as { org_code: string }).org_code || "",
    previous_plan: orgBefore.subscription_plan ?? null,
    new_plan: newPlan,
    previous_expires_at: orgBefore.expires_at ?? null,
    new_expires_at: newExpires,
    changed_by: auth.user.id,
    note: null,
  });

  return NextResponse.json({ ok: true, org }, { status: 200 });
}
