export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function normalizeUsername(raw: string) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

function normalizeOrgCode(raw: string) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

function makeInternalEmail(username: string, orgCode: string) {
  return `${normalizeUsername(username)}+${normalizeOrgCode(orgCode)}@invoiceku.local`;
}

type Body = {
  orgId?: string;      // boleh kosong kalau kamu mau auto-detect dari membership admin
  username?: string;   // kasir1
  password?: string;   // bebas
  role?: "staff" | "admin"; // default staff
};

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
            cookiesToSet.forEach(({ name, value, options }: any) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const { data: userRes, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const username = normalizeUsername(body.username || "");
  const password = String(body.password || "");
  const role: "staff" | "admin" = body.role || "staff";

  if (!username) return NextResponse.json({ error: "username wajib" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "password minimal 6 karakter" }, { status: 400 });

  // 1) tentukan orgId: dari body atau ambil org pertama user (admin)
  let orgId = String(body.orgId || "").trim();

  if (!orgId) {
    const { data: myOrg } = await supabaseUser
      .from("memberships")
      .select("org_id, role")
      .eq("user_id", userRes.user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!myOrg?.org_id) return NextResponse.json({ error: "Org tidak ditemukan" }, { status: 400 });
    orgId = myOrg.org_id;
  }

  // 2) pastikan requester adalah admin org tsb (RLS gate)
  const { data: me, error: meErr } = await supabaseUser
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (meErr) return NextResponse.json({ error: meErr.message }, { status: 403 });
  if (!me || me.role !== "admin") return NextResponse.json({ error: "Forbidden (admin only)" }, { status: 403 });

  // 3) admin client (service role) buat create auth user + insert membership
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY belum di-set" }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // ambil org_code
  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .select("org_code")
    .eq("id", orgId)
    .maybeSingle();

  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 400 });
  const orgCode = normalizeOrgCode(orgRow?.org_code || "");
  if (!orgCode) return NextResponse.json({ error: "Org code kosong. Isi org_code dulu." }, { status: 400 });

  // cek username unik per org
  const { data: exists } = await admin
    .from("memberships")
    .select("id")
    .eq("org_id", orgId)
    .eq("username", username)
    .maybeSingle();

  if (exists) {
    return NextResponse.json({ error: "Username sudah dipakai di organisasi ini" }, { status: 400 });
  }

  const email = makeInternalEmail(username, orgCode);

  // create auth user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      org_code: orgCode,
      username,
    },
  });

  if (createErr || !created?.user) {
    return NextResponse.json({ error: createErr?.message || "Gagal create user" }, { status: 400 });
  }

  // insert membership
  const { error: memErr } = await admin.from("memberships").insert({
    org_id: orgId,
    user_id: created.user.id,
    role,
    username,
  });

  if (memErr) {
    // rollback auth user biar ga nyangkut
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    return NextResponse.json({ error: memErr.message }, { status: 400 });
  }

  return NextResponse.json(
    {
      ok: true,
      org_id: orgId,
      org_code: orgCode,
      username,
      role,
      // email ini optional: biasanya ga usah ditampilkan ke user Indonesia
      internal_email: email,
      user_id: created.user.id,
    },
    { status: 200 }
  );
}