/**
 * Submit feedback (Kritik & Masukan).
 * - Auth required
 * - Derive org from memberships (based on org_code in body)
 * - Insert into feedback_submissions with status='new'
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const csAny: any = cookies() as any;
  const cookieStore = csAny?.then ? await csAny : csAny;

  const body = await req.json().catch(() => ({}));
  const orgCodeRaw = String(body?.org_code ?? "").trim();
  const category = String(body?.category ?? "").trim().toLowerCase();
  const message = String(body?.message ?? "").trim();
  const currentRoute = String(body?.current_route ?? "").trim();

  if (!orgCodeRaw) return NextResponse.json({ error: "org_code wajib diisi." }, { status: 400 });
  if (!["bug", "saran", "pertanyaan", "keluhan"].includes(category)) {
    return NextResponse.json({ error: "jenis feedback tidak valid." }, { status: 400 });
  }
  if (!message) return NextResponse.json({ error: "Pesan wajib diisi." }, { status: 400 });
  if (!currentRoute) return NextResponse.json({ error: "current_route wajib diisi." }, { status: 400 });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }: any) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgCode = orgCodeRaw.toUpperCase().replace(/\s+/g, "");

  // derive membership for safety
  const { data: mem, error: memErr } = await supabase
    .from("memberships")
    .select("org_id, role, is_active, username")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  // If membership isn't found, try by org_code
  let membership = mem;
  if (!membership || memErr) {
    const { data: memByCode } = await supabase
      .from("memberships")
      .select("org_id, role, is_active, username")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    membership = memByCode;
  }

  if (!membership?.org_id) {
    return NextResponse.json({ error: "Membership tidak ditemukan." }, { status: 403 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("org_code")
    .eq("id", membership.org_id)
    .maybeSingle();

  const derivedOrgCode = (org as any)?.org_code ?? "";
  if (!derivedOrgCode || derivedOrgCode.toUpperCase() !== orgCode) {
    return NextResponse.json({ error: "org_code tidak sesuai dengan organisasi Anda." }, { status: 403 });
  }

  const senderName = String(body?.name ?? membership.username ?? user.email ?? "").trim();
  const senderEmail = String(user.email ?? "").trim();

  if (!senderName) return NextResponse.json({ error: "Nama wajib diisi." }, { status: 400 });
  if (!senderEmail) return NextResponse.json({ error: "Email tidak ditemukan." }, { status: 400 });

  const { error: insErr } = await supabase.from("feedback_submissions").insert({
    org_id: membership.org_id,
    org_code: derivedOrgCode,
    user_id: user.id,
    name: senderName,
    email: senderEmail,
    category,
    message,
    current_route: currentRoute,
    status: "new",
    updated_at: new Date().toISOString(),
  });

  if (insErr) {
    return NextResponse.json({ error: insErr.message || "Gagal menyimpan feedback." }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

