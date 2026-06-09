// app/api/invoices/update/route.ts  (FULL REPLACE)
// ✅ Versi FINAL: TANPA discount_type / tax_type (pasti %)
// ✅ Activity log setelah RPC sukses

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/log-activity";
import { requireApiContext, num } from "@/lib/api-context";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { legacyAuthInvoiceUpdateBodySchema } from "@/lib/validations/auth";

function text(v: any) {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest) {
  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;

  const { supabase, user, orgId, actorRole } = auth.ctx;

  const parsedBody = await parseJsonBody(req, legacyAuthInvoiceUpdateBodySchema);
  if (!parsedBody.ok) return parsedBody.response;

  const invoiceId = parsedBody.data.invoiceId;
  const headerIn = parsedBody.data.header;
  const itemsIn = parsedBody.data.items;

  // ===== header FINAL (tanpa *_type) =====
  // NOTE:
  // - discount_value & tax_value = PERSEN (0-100)
  // - kalau kolom status sudah kamu hapus dari DB, hapus bagian status di bawah (biar gak ikut terkirim)
  const header = {
    customer_name: headerIn.customer_name,
    customer_phone: headerIn.customer_phone,
    customer_address: headerIn.customer_address,
    note: headerIn.note,
    invoice_date: headerIn.invoice_date,
    invoice_number: headerIn.invoice_number,
    discount_value: headerIn.discount_value != null ? num(headerIn.discount_value) : undefined,
    tax_value: headerIn.tax_value != null ? num(headerIn.tax_value) : undefined,
    // status: headerIn.status, // <-- UNCOMMENT cuma kalau kolom status masih ada di invoices
  };

  // buang undefined biar RPC gak bingung
  const cleanHeader: Record<string, any> = {};
  for (const [k, v] of Object.entries(header)) {
    if (v !== undefined) cleanHeader[k] = v;
  }

  // normalize items (selalu kirim sort_order)
  const cleanItems = itemsIn.map((it, idx) => ({
    name: text(it.name),
    qty: Math.max(0, num(it.qty)),
    price: Math.max(0, num(it.price)),
    sort_order: Number.isFinite(Number(it.sort_order)) ? Number(it.sort_order) : idx,
  }));

  // ===== RPC (transaksi + rules staff) =====
  // Pastikan function update_invoice_with_items kamu:
  // - update kolom discount_value & tax_value (numeric)
  // - sudah TIDAK pakai discount_type/tax_type lagi
  const { data, error } = await supabase.rpc("update_invoice_with_items", {
    p_invoice_id: invoiceId,
    p_header: cleanHeader,
    p_items: cleanItems,
  });

  if (error) {
    return NextResponse.json({ error: error.message, detail: error }, { status: 400 });
  }

  // ✅ Activity log (best-effort)
  const changedFields = Object.keys(cleanHeader || {});
  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "invoice.update",
    entity_type: "invoice",
    entity_id: invoiceId,
    summary: `Update invoice ${invoiceId}`,
    meta: {
      invoice_id: invoiceId,
      changed_fields: changedFields,
      items_count: cleanItems.length,
      header: {
        invoice_date: cleanHeader.invoice_date,
        customer_name: cleanHeader.customer_name,
        discount_value: cleanHeader.discount_value,
        tax_value: cleanHeader.tax_value,
        // status: cleanHeader.status, // <-- kalau status dipakai
      },
    },
  });

  return NextResponse.json({ ok: true, data }, { status: 200 });
}