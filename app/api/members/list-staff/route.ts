export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET() {
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
            cookiesToSet.forEach(({ name, value, options }: any) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const { data: userRes } = await supabaseUser.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ambil org admin sekarang (org pertama)
  const { data: myOrg, error: myOrgErr } = await supabaseUser
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (myOrgErr) return NextResponse.json({ error: myOrgErr.message }, { status: 400 });
  if (!myOrg?.org_id) return NextResponse.json({ error: "Org tidak ditemukan" }, { status: 400 });

  // gate: harus admin
  const { data: me, error: meErr } = await supabaseUser
    .from("memberships")
    .select("role")
    .eq("org_id", myOrg.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (meErr) return NextResponse.json({ error: meErr.message }, { status: 403 });
  if (!me || me.role !== "admin") return NextResponse.json({ error: "Forbidden (admin only)" }, { status: 403 });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY belum di-set" }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // org_code untuk ditampilkan ke admin
  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .select("id, name, org_code")
    .eq("id", myOrg.org_id)
    .maybeSingle();

  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 400 });

  const { data: members, error: membersErr } = await admin
    .from("memberships")
    .select("id, user_id, org_id, username, role, created_at, is_active")
    .eq("org_id", myOrg.org_id)
    .order("created_at", { ascending: false });

  if (membersErr) return NextResponse.json({ error: membersErr.message }, { status: 400 });

  return NextResponse.json(
    { org: orgRow || null, members: members || [] },
    { status: 200 }
  );
}