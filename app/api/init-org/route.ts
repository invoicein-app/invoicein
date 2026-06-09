// app/api/init-org/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseFromCookies } from "@/lib/api-context";
import { buildNewOrgSubscriptionFields } from "@/lib/subscription";
import { ensureOrgSubscription } from "@/lib/org-subscription";

function normalizeOrgCode(raw: string) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function makeOrgCodeFromName(name: string) {
  const base = normalizeOrgCode(name).slice(0, 4);
  const suffix = randomCode(3);
  const merged = normalizeOrgCode(`${base}${suffix}`);
  return merged.length >= 4 ? merged : normalizeOrgCode(`ORG${randomCode(3)}`);
}

async function createOrgWithUniqueCode(admin: any, orgName: string) {
  const subFields = buildNewOrgSubscriptionFields();

  for (let attempt = 0; attempt < 8; attempt++) {
    const orgCode = makeOrgCodeFromName(orgName);

    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({
        name: orgName,
        org_code: orgCode,
        ...subFields,
      })
      .select("id, org_code")
      .single();

    if (!orgErr && org) return org;

    const msg = String((orgErr as any)?.message || "");
    const code = String((orgErr as any)?.code || "");

    if (code === "23505" || msg.toLowerCase().includes("duplicate key")) {
      continue;
    }

    throw orgErr;
  }

  throw new Error("Gagal membuat org_code unik. Coba lagi.");
}

export async function POST() {
  const supabaseUser = await getSupabaseFromCookies();

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

  const { data: mem } = await admin
    .from("memberships")
    .select("id, org_id, role, organizations(org_code)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (mem?.org_id) {
    try {
      await ensureOrgSubscription(admin, mem.org_id);
    } catch (e: any) {
      console.error("[init-org] ensureOrgSubscription:", e?.message || e);
    }

    const orgCode = (mem as any)?.organizations?.org_code || null;
    return NextResponse.json({ ok: true, org_id: mem.org_id, role: mem.role, org_code: orgCode });
  }

  const orgName = process.env.APP_COMPANY_NAME || "UMKM";

  try {
    const org = await createOrgWithUniqueCode(admin, orgName);

    const { error: memErr } = await admin
      .from("memberships")
      .insert({ org_id: org.id, user_id: userId, role: "admin" });

    if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, org_id: org.id, role: "admin", org_code: org.org_code });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal init org" }, { status: 400 });
  }
}
