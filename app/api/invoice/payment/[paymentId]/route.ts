// app/api/invoice/payment/[paymentId]/route.ts  (REPLACE FULL)
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { updateInvoicePaymentBodySchema } from "@/lib/validations/payment";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await ctx.params;

  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;

  const { supabase, orgId } = auth.ctx;

  const parsedBody = await parseJsonBody(req, updateInvoicePaymentBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const { data: payRow } = await supabase
    .from("invoice_payments")
    .select("invoice_id")
    .eq("id", paymentId)
    .maybeSingle();
  const invoiceId = (payRow as any)?.invoice_id;
  if (invoiceId) {
    const { data: invRow } = await supabase
      .from("invoices")
      .select("org_id")
      .eq("id", invoiceId)
      .maybeSingle();
    if (invRow && String((invRow as any).org_id) !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const patch: Record<string, unknown> = {};
  if (body.amount !== undefined) patch.amount = body.amount;
  if (body.paid_at !== undefined) patch.paid_at = body.paid_at;
  if (body.note !== undefined) patch.note = body.note;

  const { error } = await supabase.from("invoice_payments").update(patch).eq("id", paymentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await ctx.params;

  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;

  const { supabase, orgId } = auth.ctx;

  const { data: payRow } = await supabase
    .from("invoice_payments")
    .select("invoice_id")
    .eq("id", paymentId)
    .maybeSingle();
  const invoiceId = (payRow as any)?.invoice_id;
  if (invoiceId) {
    const { data: invRow } = await supabase
      .from("invoices")
      .select("org_id")
      .eq("id", invoiceId)
      .maybeSingle();
    if (invRow && String((invRow as any).org_id) !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { error } = await supabase.from("invoice_payments").delete().eq("id", paymentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
