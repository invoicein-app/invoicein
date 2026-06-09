export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { addInvoicePaymentBodySchema } from "@/lib/validations/payment";

function calcGrandTotal(inv: any) {
  const items = inv.invoice_items || [];
  const subtotal =
    items.reduce(
      (acc: number, it: any) =>
        acc + Number(it.qty || 0) * Number(it.price || 0),
      0
    ) || 0;

  const discount =
    inv.discount_type === "percent"
      ? subtotal * (Number(inv.discount_value || 0) / 100)
      : Number(inv.discount_value || 0);

  const afterDisc = Math.max(0, subtotal - Math.max(0, discount));

  const tax =
    inv.tax_type === "percent"
      ? afterDisc * (Number(inv.tax_value || 0) / 100)
      : Number(inv.tax_value || 0);

  const grandTotal = Math.max(0, afterDisc + Math.max(0, tax));
  return grandTotal;
}

export async function POST(req: Request) {
  try {
    const parsedBody = await parseJsonBody(req, addInvoicePaymentBodySchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { invoiceId, amount } = parsedBody.data;

    const auth = await requireApiContext({ requireWrite: true });
    if (!auth.ok) return auth.response;

    const { supabase, orgId } = auth.ctx;

    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .select(
        `
        id,
        org_id,
        status,
        amount_paid,
        discount_type,
        discount_value,
        tax_type,
        tax_value,
        invoice_items ( qty, price )
      `
      )
      .eq("id", invoiceId)
      .single();

    if (invErr || !inv) {
      return NextResponse.json({ error: invErr?.message || "Invoice not found" }, { status: 404 });
    }

    if (String((inv as any).org_id || "") !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const grandTotal = calcGrandTotal(inv);
    const oldPaid = Math.max(0, Number(inv.amount_paid || 0));
    const newPaid = oldPaid + amount;

    const updatePayload: any = {
      amount_paid: newPaid,
    };

    if (grandTotal > 0 && newPaid >= grandTotal) {
      updatePayload.status = "paid";
    }

    const { data: updated, error: upErr } = await supabase
      .from("invoices")
      .update(updatePayload)
      .eq("id", invoiceId)
      .select("id, status, amount_paid")
      .single();

    if (upErr || !updated) {
      return NextResponse.json({ error: upErr?.message || "Update failed" }, { status: 400 });
    }

    const paid = Math.max(0, Number(updated.amount_paid || 0));
    const remaining = Math.max(0, grandTotal - paid);

    const payStatus =
      grandTotal <= 0 ? "UNPAID" : paid >= grandTotal ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";

    return NextResponse.json({
      ok: true,
      invoiceId,
      grandTotal,
      paid,
      remaining,
      payStatus,
      status: updated.status,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
