export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiContext, requireWriteForOrg } from "@/lib/api-context";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { setMemberActiveBodySchema } from "@/lib/validations/member";

export async function POST(req: NextRequest) {
  const auth = await requireApiContext({ requireAdmin: true });
  if (!auth.ok) return auth.response;
  const { supabase: supabaseUser, user: meUser } = auth.ctx;

  const parsedBody = await parseJsonBody(req, setMemberActiveBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const { memberId, isActive } = parsedBody.data;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY belum di-set" }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // ambil target member + org_id
  const { data: target, error: targetErr } = await admin
    .from("memberships")
    .select("id, org_id, role, user_id")
    .eq("id", memberId)
    .maybeSingle();

  if (targetErr) return NextResponse.json({ error: targetErr.message }, { status: 400 });
  if (!target) return NextResponse.json({ error: "Member tidak ditemukan" }, { status: 404 });

  const subBlock = await requireWriteForOrg(supabaseUser, target.org_id);
  if (subBlock) return subBlock;

  // gate: requester harus admin di org yg sama
  const { data: myMem, error: myMemErr } = await admin
    .from("memberships")
    .select("role, is_active")
    .eq("org_id", target.org_id)
    .eq("user_id", meUser.id)
    .maybeSingle();

  if (myMemErr) return NextResponse.json({ error: myMemErr.message }, { status: 403 });
  if (!myMem || myMem.role !== "admin") return NextResponse.json({ error: "Forbidden (admin only)" }, { status: 403 });

  // jangan allow admin disable dirinya sendiri (biar ga ngunci org)
  if (target.user_id === meUser.id) {
    return NextResponse.json({ error: "Tidak bisa disable akun sendiri." }, { status: 400 });
  }

  const patch: any = {
    is_active: isActive,
    disabled_at: isActive ? null : new Date().toISOString(),
    disabled_by: isActive ? null : meUser.id,
  };

  const { error: upErr } = await admin.from("memberships").update(patch).eq("id", memberId);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  return NextResponse.json({ ok: true }, { status: 200 });
}