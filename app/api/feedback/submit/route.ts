/**
 * Submit feedback (Kritik & Masukan).
 * - Auth required
 * - Derive org from memberships (based on org_code in body)
 * - Insert into feedback_submissions with status='new'
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { submitFeedbackBodySchema } from "@/lib/validations/feedback";

export async function POST(req: Request) {
  const parsedBody = await parseJsonBody(req, submitFeedbackBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const { org_code: orgCodeRaw, category, message, current_route: currentRoute, name: bodyName } =
    parsedBody.data;

  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth.ctx;

  const orgCode = orgCodeRaw.toUpperCase().replace(/\s+/g, "");

  const { data: org } = await supabase
    .from("organizations")
    .select("org_code")
    .eq("id", orgId)
    .maybeSingle();

  const derivedOrgCode = (org as any)?.org_code ?? "";
  if (!derivedOrgCode || derivedOrgCode.toUpperCase() !== orgCode) {
    return NextResponse.json({ error: "org_code tidak sesuai dengan organisasi Anda." }, { status: 403 });
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("username")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .eq("is_active", true)
    .maybeSingle();

  const senderName = String(bodyName ?? membership?.username ?? user.email ?? "").trim();
  const senderEmail = String(user.email ?? "").trim();

  if (!senderName) return NextResponse.json({ error: "Nama wajib diisi." }, { status: 400 });
  if (!senderEmail) return NextResponse.json({ error: "Email tidak ditemukan." }, { status: 400 });

  const { error: insErr } = await supabase.from("feedback_submissions").insert({
    org_id: orgId,
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
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
