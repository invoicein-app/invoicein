// invoiceku/app/api/invoices/[id]/route.ts
// PATCH /api/invoices/:id
// FIX: sanitize header biar gak ada status "unpaid" nyasar ke enum invoice_status
// PLUS: activity log invoice.update

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/log-activity";
import { requireApiContext, num, asText } from "@/lib/api-context";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { legacyAuthInvoicePatchBodySchema } from "@/lib/validations/auth";

// ✅ whitelist header yang boleh diupdate (ini penting!)
function pickSafeHeader(raw: Record<string, any>) {
  const h = raw || {};

  // ambil hanya field yang kamu izinkan
  const safe: Record<string, any> = {
    customer_name: h.customer_name,
    customer_phone: h.customer_phone,
    customer_address: h.customer_address,
    note: h.note,
    invoice_date: h.invoice_date,

    // kalau kamu mau izinkan invoice_number via RPC admin-only
    invoice_number: h.invoice_number,
    discount_value: h.discount_value,
    tax_value: h.tax_value,
  };

  // normalize string kosong -> null (optional)
  for (const k of ["customer_phone", "customer_address", "note", "invoice_number"] as const) {
    if (safe[k] != null && String(safe[k]).trim() === "") safe[k] = "";
  }

  // normalize numeric
  if (safe.discount_value != null) safe.discount_value = num(safe.discount_value);
  if (safe.tax_value != null) safe.tax_value = num(safe.tax_value);

  // 🔥 PENTING: jangan pernah kirim status ke RPC (biar gak nabrak enum)
  delete safe.status;
  delete safe.payStatus;
  delete safe.remaining;
  delete safe.grandTotal;
  delete safe.paid;
  delete safe.amount_paid;
  delete safe.discount_type;
  delete safe.tax_type;

  return safe;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invoiceId = asText(id);

  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoice id" }, { status: 400 });
  }

  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;

  const { supabase, user, orgId, actorRole } = auth.ctx;

  const parsedBody = await parseJsonBody(req, legacyAuthInvoicePatchBodySchema);
  if (!parsedBody.ok) return parsedBody.response;

  const rawHeader = (parsedBody.data.header ?? parsedBody.data.invoice ?? {}) as Record<string, unknown>;
  const items = parsedBody.data.items;

  // ambil nomor invoice untuk summary/meta
  const { data: invRow } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("id", invoiceId)
    .maybeSingle();

  const invoiceNumber = (invRow as any)?.invoice_number ?? null;

  // ✅ sanitize header (buang status/unpaid dll)
  const safeHeader = pickSafeHeader(rawHeader);

  // ✅ RPC transaksi
  const { data, error } = await supabase.rpc("update_invoice_with_items", {
    p_invoice_id: invoiceId,
    p_header: safeHeader,
    p_items: items,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message, detail: error },
      { status: 400 }
    );
  }

  // ✅ Activity log (jangan bikin request utama gagal kalau log gagal)
  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "invoice.update",
    entity_type: "invoice",
    entity_id: invoiceId,
    summary: `Update invoice ${invoiceNumber || invoiceId}`,
    meta: {
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      header: safeHeader,
      items_count: items.length,
    },
  });

  return NextResponse.json({ ok: true, data }, { status: 200 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json({ ok: true, id }, { status: 200 });
}