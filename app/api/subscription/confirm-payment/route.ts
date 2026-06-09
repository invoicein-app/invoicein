/**
 * User submits payment confirmation for subscription renewal.
 * Requires auth; org_id must belong to user's membership. Inserts into payment_confirmations.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { confirmSubscriptionPaymentBodySchema } from "@/lib/validations/admin";

export async function POST(req: Request) {
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const parsedBody = await parseJsonBody(req, confirmSubscriptionPaymentBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;
  const orgId = body.org_id;

  const { data: mem } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .eq("is_active", true)
    .maybeSingle();

  if (!mem?.org_id) return NextResponse.json({ error: "Organisasi tidak ditemukan atau tidak ada akses." }, { status: 403 });

  const {
    target_package: targetPackage,
    sender_account_name: senderAccountName,
    sender_bank: senderBank,
    sender_account_number: senderAccountNumber,
    transfer_amount: transferAmount,
    transfer_date: transferDate,
    note: noteRaw,
  } = body;
  const note = noteRaw != null ? String(noteRaw).trim() : null;

  const { data: row, error } = await supabase
    .from("payment_confirmations")
    .insert({
      org_id: orgId,
      user_id: user.id,
      target_package: targetPackage,
      sender_account_name: senderAccountName,
      sender_bank: senderBank,
      sender_account_number: senderAccountNumber,
      transfer_amount: transferAmount,
      transfer_date: transferDate,
      note: note || null,
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .select("id, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: row.id, created_at: row.created_at }, { status: 200 });
}
