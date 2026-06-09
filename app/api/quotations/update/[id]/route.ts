export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { updateQuotationBodySchema } from "@/lib/validations/quotation";
import { coerceDateOrToday } from "@/lib/document-numbering";

function clampInt(n: number, min: number, max: number) {
  const x = Math.floor(n);
  if (x < min) return min;
  if (x > max) return max;
  return x;
}

function computeTotals(
  items: Array<{ qty: number; price: number }>,
  dt: "percent" | "amount",
  dVal: number,
  taxPct: number
) {
  const subtotal = items.reduce((a, it) => a + it.qty * it.price, 0);

  let discountAmount = dt === "percent" ? Math.floor(subtotal * (dVal / 100)) : Math.floor(dVal);
  if (discountAmount > subtotal) discountAmount = subtotal;
  if (discountAmount < 0) discountAmount = 0;

  const afterDisc = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.floor(afterDisc * (taxPct / 100));
  const total = Math.max(0, afterDisc + taxAmount);

  return { subtotal, discountAmount, taxAmount, total };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const parsedBody = await parseJsonBody(req, updateQuotationBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const {
    quotation_date,
    customer_id,
    customer_name,
    customer_phone,
    customer_address,
    note,
    discount_type,
    discount_value,
    tax_value: taxPct,
    items,
  } = body;

  const dType = discount_type ?? "percent";

  const { data: qRow, error: qErr } = await supabase
    .from("quotations")
    .select("id,is_locked,invoice_id")
    .eq("id", id)
    .maybeSingle();

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 400 });
  if (!qRow) return NextResponse.json({ error: "Quotation tidak ditemukan / tidak punya akses." }, { status: 404 });
  if ((qRow as { is_locked?: boolean }).is_locked) {
    return NextResponse.json({ error: "Quotation ini LOCKED, tidak bisa di-edit." }, { status: 400 });
  }

  let dVal = 0;
  if (dType === "percent") dVal = clampInt(discount_value, 0, 100);
  else dVal = Math.max(0, Math.floor(discount_value));

  const normItems = items.map((it, idx) => ({
    product_id: it.product_id,
    name: it.name,
    qty: it.qty,
    price: it.price,
    sort_order: idx,
  }));

  const { subtotal, discountAmount, taxAmount, total } = computeTotals(
    normItems.map((x) => ({ qty: x.qty, price: x.price })),
    dType,
    dVal,
    taxPct
  );

  const { error: upErr } = await supabase
    .from("quotations")
    .update({
      quotation_date: coerceDateOrToday(quotation_date || undefined),
      customer_id,
      customer_name,
      customer_phone,
      customer_address,
      note,
      discount_type: dType,
      discount_value: dVal,
      tax_value: taxPct,
      subtotal,
      total,
    })
    .eq("id", id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  const { error: delErr } = await supabase.from("quotation_items").delete().eq("quotation_id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  const insPayload = normItems.map((it) => ({
    quotation_id: id,
    product_id: it.product_id,
    name: it.name,
    qty: it.qty,
    price: it.price,
    sort_order: it.sort_order,
  }));

  const { error: insErr } = await supabase.from("quotation_items").insert(insPayload);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

  return NextResponse.json(
    { ok: true, id, subtotal, discount_amount: discountAmount, tax_amount: taxAmount, total },
    { status: 200 }
  );
}
