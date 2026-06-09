export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiContext, requireWriteForOrg } from "@/lib/api-context";
import { getStaffLimitForPlan, getActiveStaffCount } from "@/lib/subscription";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { createStaffBodySchema } from "@/lib/validations/member";

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

export async function POST(req: NextRequest) {
  const auth = await requireApiContext({ requireAdmin: true });
  if (!auth.ok) return auth.response;
  const { supabase: supabaseUser, user } = auth.ctx;

  const parsedBody = await parseJsonBody(req, createStaffBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const { orgId: bodyOrgId, password, role } = parsedBody.data;
  const username = normalizeUsername(parsedBody.data.username);

  if (!username) return NextResponse.json({ error: "username wajib" }, { status: 400 });

  // 1) tentukan orgId: dari body atau ambil org pertama user (admin)
  let orgId = String(bodyOrgId || "").trim();

  if (!orgId) {
    orgId = auth.ctx.orgId;
  }

  const subBlock = await requireWriteForOrg(supabaseUser, orgId);
  if (subBlock) return subBlock;

  // 3) admin client (service role) buat create auth user + insert membership
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY belum di-set" }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // Staff limit by plan (backend enforcement)
  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .select("org_code, subscription_plan")
    .eq("id", orgId)
    .maybeSingle();

  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 400 });
  const orgCode = normalizeOrgCode(orgRow?.org_code || "");
  if (!orgCode) return NextResponse.json({ error: "Org code kosong. Isi org_code dulu." }, { status: 400 });

  const plan = (orgRow?.subscription_plan as "basic" | "standard") || "basic";
  const staffLimit = getStaffLimitForPlan(plan);
  const activeStaffCount = await getActiveStaffCount(admin, orgId);
  if (activeStaffCount >= staffLimit) {
    const planLabel = plan === "standard" ? "Standard" : "Basic";
    return NextResponse.json(
      { error: `Batas staff untuk paket ${planLabel} sudah tercapai.` },
      { status: 403 }
    );
  }

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