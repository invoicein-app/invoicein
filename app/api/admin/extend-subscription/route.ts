/**
 * Admin-only: extend subscription by 1 month for an org identified by org_code.
 * Body: { org_code: string }
 * Use after manual payment verification.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function isAdminRole(role: string) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "owner" || r === "super_admin";
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: mem } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", userRes.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const role = (mem as any)?.role || "";
  if (!isAdminRole(role)) {
    return NextResponse.json({ error: "Hanya admin yang bisa perpanjang langganan." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const orgCode = String(body?.org_code || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!orgCode) {
    return NextResponse.json({ error: "org_code wajib diisi." }, { status: 400 });
  }

  const { data: org, error: orgErr } = await supabase
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

  const { error: upErr } = await supabase
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
