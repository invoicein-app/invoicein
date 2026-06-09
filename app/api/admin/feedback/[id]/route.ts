/**
 * Update feedback status/admin note.
 * Only org admin can update their org's feedback.
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { updateFeedbackStatusBodySchema } from "@/lib/validations/feedback";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id?.trim();
  if (!id) return NextResponse.json({ error: "ID wajib." }, { status: 400 });

  const parsedBody = await parseJsonBody(req, updateFeedbackStatusBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const nextStatus = parsedBody.data.status;
  const adminNote =
    parsedBody.data.admin_note != null ? String(parsedBody.data.admin_note).trim() : null;

  const auth = await requireApiContext({ requireAdmin: true });
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth.ctx;

  const { data: row, error: loadErr } = await supabase
    .from("feedback_submissions")
    .select("id, org_id")
    .eq("id", id)
    .maybeSingle();

  if (loadErr || !row) return NextResponse.json({ error: "Feedback tidak ditemukan." }, { status: 404 });
  if (row.org_id !== orgId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { error: upErr } = await supabase
    .from("feedback_submissions")
    .update({
      status: nextStatus,
      admin_note: adminNote || null,
      reviewed_at: nextStatus === "read" || nextStatus === "processed" || nextStatus === "done" ? new Date().toISOString() : null,
      reviewed_by: nextStatus === "read" || nextStatus === "processed" || nextStatus === "done" ? user.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
  return NextResponse.json({ ok: true }, { status: 200 });
}
