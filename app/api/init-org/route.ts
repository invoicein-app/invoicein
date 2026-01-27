// app/api/init-org/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function normalizeOrgCode(raw: string) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

// kode random yang pendek tapi lumayan unik
function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // skip O/0/I/1 biar gak membingungkan
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// bikin org code dari nama + random
function makeOrgCodeFromName(name: string) {
  const base = normalizeOrgCode(name).slice(0, 4); // contoh: SURY
  const suffix = randomCode(3); // contoh: 7KQ
  const merged = normalizeOrgCode(`${base}${suffix}`);
  // jaga-jaga kalau name kosong
  return merged.length >= 4 ? merged : normalizeOrgCode(`ORG${randomCode(3)}`);
}

async function createOrgWithUniqueCode(admin: any, orgName: string) {
  // retry beberapa kali kalau collision (karena UNIQUE)
  for (let attempt = 0; attempt < 8; attempt++) {
    const orgCode = makeOrgCodeFromName(orgName);

    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({ name: orgName, org_code: orgCode })
      .select("id, org_code")
      .single();

    if (!orgErr && org) return org;

    // kalau error karena unique violation, retry
    const msg = String((orgErr as any)?.message || "");
    const code = String((orgErr as any)?.code || "");

    // Postgres unique violation = 23505
    if (code === "23505" || msg.toLowerCase().includes("duplicate key")) {
      continue;
    }

    // error lain -> lempar
    throw orgErr;
  }

  throw new Error("Gagal membuat org_code unik. Coba lagi.");
}

export async function POST() {
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
            cookiesToSet.forEach(({ name, value, options }: any) => {
              cookieStore.set(name, value, options);
            });
          } catch {}
        },
      },
    }
  );

  const { data: userRes, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = userRes.user.id;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY belum di-set" }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // kalau sudah punya membership, return
  const { data: mem } = await admin
    .from("memberships")
    .select("id, org_id, role, organizations(org_code)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (mem?.org_id) {
    const orgCode = (mem as any)?.organizations?.org_code || null;
    return NextResponse.json({ ok: true, org_id: mem.org_id, role: mem.role, org_code: orgCode });
  }

  const orgName = process.env.APP_COMPANY_NAME || "UMKM";

  try {
    // ✅ create org + auto org_code
    const org = await createOrgWithUniqueCode(admin, orgName);

    // ✅ create membership admin
    const { error: memErr } = await admin
      .from("memberships")
      .insert({ org_id: org.id, user_id: userId, role: "admin" });

    if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, org_id: org.id, role: "admin", org_code: org.org_code });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal init org" }, { status: 400 });
  }
}