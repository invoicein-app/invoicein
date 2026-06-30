export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logActivity } from "@/lib/log-activity";
import { coerceDateOrToday } from "@/lib/document-numbering";
import { asText, requireApiContext } from "@/lib/api-context";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { createDeliveryNoteBodySchema } from "@/lib/validations/delivery-note";
import { createAndFinalizeDeliveryNote, rollbackDeliveryNoteCreate } from "@/lib/delivery-note-post";
import { insertDeliveryNoteWithAllocatedNumber } from "@/lib/delivery-note-numbering";

function isUuid(v: unknown) {
  const s = String(v || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(req: NextRequest) {
  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId, actorRole } = auth.ctx;

  const parsedBody = await parseJsonBody(req, createDeliveryNoteBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const sj_date = coerceDateOrToday(body.sj_date || undefined);
  const shipping_address = body.shipping_address;
  const driver_name = body.driver_name;
  const note = body.note;
  const warehouse_id = body.warehouse_id;
  const customer_id = body.customer_id;
  let customer_name = body.customer_name;
  let customer_phone = body.customer_phone ? String(body.customer_phone).trim() : null;
  const invoice_id = body.invoice_id;
  const items = body.items;

  if (customer_id) {
    const { data: cust, error: custErr } = await supabase
      .from("customers")
      .select("id, name, phone, address")
      .eq("id", customer_id)
      .maybeSingle();

    if (custErr) return NextResponse.json({ error: custErr.message }, { status: 400 });
    if (!cust) return NextResponse.json({ error: "Customer tidak ditemukan." }, { status: 404 });

    customer_name = asText(cust.name) || customer_name;
    customer_phone = asText(cust.phone) || customer_phone;
  }

  if (!customer_name) {
    return NextResponse.json({ error: "Nama customer wajib diisi." }, { status: 400 });
  }

  let linkedInvoiceId: string | null = null;
  if (invoice_id) {
    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .select("id, org_id, status, customer_name, customer_phone, customer_address")
      .eq("id", invoice_id)
      .maybeSingle();

    if (invErr) return NextResponse.json({ error: invErr.message }, { status: 400 });
    if (!inv || String(inv.org_id) !== orgId) {
      return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    }
    if (String(inv.status || "").toLowerCase() === "cancelled") {
      return NextResponse.json({ error: "Invoice cancelled tidak bisa dihubungkan." }, { status: 400 });
    }

    const { data: existingDn } = await supabase
      .from("delivery_notes")
      .select("id")
      .eq("org_id", orgId)
      .eq("invoice_id", invoice_id)
      .maybeSingle();

    if (existingDn?.id) {
      return NextResponse.json(
        { error: "Invoice ini sudah punya Surat Jalan.", existing_id: existingDn.id },
        { status: 409 }
      );
    }

    linkedInvoiceId = invoice_id;
    if (!customer_name) customer_name = asText(inv.customer_name);
    if (!customer_phone) customer_phone = asText(inv.customer_phone) || null;
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY belum di-set di .env.local" },
      { status: 500 }
    );
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const productIds = [...new Set(items.map((it) => it.product_id).filter(Boolean))] as string[];
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

  const insertPayload = {
    org_id: orgId,
    invoice_id: linkedInvoiceId,
    customer_id: customer_id && isUuid(customer_id) ? customer_id : null,
    customer_name,
    customer_phone,
    shipping_address,
    driver_name: driver_name || "",
    note: note || "",
    warehouse_id: warehouse_id && isUuid(warehouse_id) ? warehouse_id : null,
    created_by: user.id,
  };

  const inserted = await insertDeliveryNoteWithAllocatedNumber({
    supabase,
    admin,
    orgId,
    sjDate: sj_date,
    payload: insertPayload,
  });

  if (inserted.error || !inserted.data?.id) {
    const msg = String((inserted.error as { message?: string } | null)?.message || "Gagal buat surat jalan.");
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const deliveryNoteId = String(inserted.data.id);
  const { data: createdDn, error: createdDnErr } = await supabase
    .from("delivery_notes")
    .select("id, sj_number, sj_date, status")
    .eq("id", deliveryNoteId)
    .single();

  if (createdDnErr || !createdDn) {
    await rollbackDeliveryNoteCreate(supabase, deliveryNoteId);
    return NextResponse.json({ error: createdDnErr?.message || "SJ dibuat, tapi gagal ambil data." }, { status: 500 });
  }
  const itemPayload = items.map((it) => ({
    delivery_note_id: deliveryNoteId,
    name: it.name,
    qty: it.qty,
    sort_order: it.sort_order,
    unit: it.unit || (it.product_id ? productUnitMap.get(it.product_id) || null : null),
    product_id: it.product_id,
    item_key: it.item_key,
  }));

  const { error: itemsErr } = await admin.from("delivery_note_items").insert(itemPayload);
  if (itemsErr) {
    await rollbackDeliveryNoteCreate(supabase, deliveryNoteId);
    return NextResponse.json({ error: itemsErr.message }, { status: 400 });
  }

  const finalize = await createAndFinalizeDeliveryNote({
    supabase,
    admin,
    orgId,
    userId: user.id,
    actorRole,
    deliveryNoteId,
    invoiceId: linkedInvoiceId,
  });

  if (!finalize.ok) {
    return NextResponse.json({ error: finalize.error }, { status: finalize.status });
  }

  const { data: finalizedDn } = await supabase
    .from("delivery_notes")
    .select("id, sj_number, sj_date, status")
    .eq("id", deliveryNoteId)
    .maybeSingle();

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "delivery_note.create_manual",
    entity_type: "delivery_note",
    entity_id: deliveryNoteId,
    summary: `Buat Surat Jalan ${finalizedDn?.sj_number || deliveryNoteId} untuk ${customer_name}`,
    meta: {
      delivery_note_id: deliveryNoteId,
      invoice_id: linkedInvoiceId,
      status: finalizedDn?.status || "posted",
      stock_moved: finalize.stock_moved,
    },
  });

  return NextResponse.json({
    ok: true,
    id: deliveryNoteId,
    delivery_note: finalizedDn || createdDn,
    status: finalizedDn?.status || "posted",
    stock_moved: finalize.stock_moved,
  });
}
