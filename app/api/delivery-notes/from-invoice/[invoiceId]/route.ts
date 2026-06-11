// app/api/delivery-notes/from-invoice/[invoiceId]/route.ts
// FULL REPLACE (fix: driver_name NOT NULL, invoice gak punya shipping_address)

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiContext, asText } from "@/lib/api-context";

export async function POST(_req: Request, ctx: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await ctx.params;

  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;
  const { supabase: supabaseUser, user } = auth.ctx;

  // RLS gate: pastikan invoice ini bisa diakses user
  const { data: invGate, error: invGateErr } = await supabaseUser
    .from("invoices")
    .select("id, org_id")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invGateErr) return NextResponse.json({ error: invGateErr.message }, { status: 403 });
  if (!invGate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 3) service role (buat insert SJ + items)
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // ambil invoice + items
  const { data: inv, error: invErr } = await admin.from("invoices").select("*").eq("id", invoiceId).single();
  if (invErr || !inv) return NextResponse.json({ error: invErr?.message || "Invoice not found" }, { status: 400 });

  const { data: items, error: itemsErr } = await admin
    .from("invoice_items")
    .select("name, qty, sort_order, product_id, item_key, unit")
    .eq("invoice_id", invoiceId)
    .order("sort_order", { ascending: true });

  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 400 });

  const productIds = [
    ...new Set((items || []).map((it: { product_id?: string | null }) => asText(it.product_id)).filter(Boolean)),
  ];

  let productUnitMap = new Map<string, string | null>();
  if (productIds.length > 0) {
    const { data: products, error: prodErr } = await admin
      .from("products")
      .select("id, unit")
      .in("id", productIds);

    if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 400 });

    productUnitMap = new Map(
      (products || []).map((p: { id: string; unit: string | null }) => [
        String(p.id),
        asText(p.unit) || null,
      ])
    );
  }

  // 4) insert delivery note
  // NOTE:
  // - schema kamu: delivery_notes.driver_name NOT NULL -> jangan null, pakai "" dulu biar fleksibel
  // - invoice table kamu gak ada shipping_address -> pakai customer_address
  const { data: dn, error: dnErr } = await admin
    .from("delivery_notes")
    .insert({
      org_id: invGate.org_id,
      invoice_id: invoiceId,
      customer_name: String(inv.customer_name || "").trim(),
      customer_phone: String(inv.customer_phone || "").trim() || null,
      sj_date: new Date().toISOString().slice(0, 10),
      shipping_address: (inv.customer_address || "").toString(),
      driver_name: "", // ✅ FIX: jangan null kalau kolom NOT NULL
      note: "", // biar aman kalau nanti kamu bikin NOT NULL juga
      created_by: user.id,
    })
    .select("id, sj_number")
    .single();

  if (dnErr || !dn) {
    return NextResponse.json({ error: dnErr?.message || "Failed create delivery note" }, { status: 400 });
  }

  // 5) insert delivery note items
  if ((items || []).length) {
    const payload = (items || []).map((it: any, i: number) => {
      const productId = asText(it.product_id) || null;
      const unitFromInvoice = asText(it.unit) || null;
      const unitFromProduct = productId ? productUnitMap.get(productId) || null : null;

      return {
        delivery_note_id: dn.id,
        name: String(it.name || ""),
        qty: Number(it.qty || 0),
        sort_order: it.sort_order ?? i,
        unit: unitFromInvoice || unitFromProduct || null,
        product_id: productId,
        item_key: asText(it.item_key) || null,
      };
    });

    const { error: dnItemsErr } = await admin.from("delivery_note_items").insert(payload);
    if (dnItemsErr) return NextResponse.json({ error: dnItemsErr.message }, { status: 400 });
  }
await admin
  .from("invoices")
  .update({
    delivery_note_id: dn.id,
    sj_number: dn.sj_number,
  })
  .eq("id", invoiceId);
  return NextResponse.json({ id: dn.id, sj_number: dn.sj_number }, { status: 200 });
}