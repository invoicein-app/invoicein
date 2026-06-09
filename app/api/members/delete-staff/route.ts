export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiContext, requireWriteForOrg } from "@/lib/api-context";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { deleteStaffBodySchema } from "@/lib/validations/member";

export async function POST(req: NextRequest) {
  const auth = await requireApiContext({ requireAdmin: true });
  if (!auth.ok) return auth.response;
  const { supabase: supabaseUser, user: meUser } = auth.ctx;

  const parsedBody = await parseJsonBody(req, deleteStaffBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const { memberId } = parsedBody.data;

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

  const subBlock = await requireWriteForOrg(supabaseUser, target.org_id);
  if (subBlock) return subBlock;

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