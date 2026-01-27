export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type Body = { memberId?: string };

export async function POST(req: NextRequest) {
  const csAny: any = cookies() as any;
  const cookieStore: any = csAny?.then ? await csAny : csAny;

  const supabaseUser = createServerClient(
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

  const { data: userRes } = await supabaseUser.auth.getUser();
  const meUser = userRes.user;
  if (!meUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const memberId = String(body.memberId || "").trim();
  if (!memberId) return NextResponse.json({ error: "memberId wajib" }, { status: 400 });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY belum di-set" }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: target, error: targetErr } = await admin
    .from("memberships")
    .select("id, org_id, user_id, role")
    .eq("id", memberId)
    .maybeSingle();

  if (targetErr) return NextResponse.json({ error: targetErr.message }, { status: 400 });
  if (!target) return NextResponse.json({ error: "Member tidak ditemukan" }, { status: 404 });

  // gate admin org
  const { data: myMem, error: myMemErr } = await admin
    .from("memberships")
    .select("role")
    .eq("org_id", target.org_id)
    .eq("user_id", meUser.id)
    .maybeSingle();

  if (myMemErr) return NextResponse.json({ error: myMemErr.message }, { status: 403 });
  if (!myMem || myMem.role !== "admin") return NextResponse.json({ error: "Forbidden (admin only)" }, { status: 403 });

  if (target.user_id === meUser.id) {
    return NextResponse.json({ error: "Tidak bisa delete akun sendiri." }, { status: 400 });
  }

  // 1) hapus membership dulu
  const { error: delMemErr } = await admin.from("memberships").delete().eq("id", memberId);
  if (delMemErr) return NextResponse.json({ error: delMemErr.message }, { status: 400 });

  // 2) hapus auth user
  const { error: delUserErr } = await admin.auth.admin.deleteUser(target.user_id);
  if (delUserErr) {
    // kalau ini gagal, membership udah hilang; kasih error biar kamu tau
    return NextResponse.json({ error: delUserErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}