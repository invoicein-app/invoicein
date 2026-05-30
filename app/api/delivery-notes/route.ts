export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logActivity } from "@/lib/log-activity";
import { coerceDateOrToday } from "@/lib/document-numbering";
import { asText, getAuthAndOrg, getSupabaseFromCookies, num } from "@/lib/api-auth-org";
import { requireCanWrite } from "@/lib/subscription";

type ManualItemInput = {
  name?: string;
  qty?: number | string;
  unit?: string;
  product_id?: string;
  item_key?: string;
};

function isUuid(v: unknown) {
  const s = String(v || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function normalizeItems(raw: unknown) {
  const list = Array.isArray(raw) ? raw : [];
  const out: {
    name: string;
    qty: number;
    unit: string | null;
    product_id: string | null;
    item_key: string | null;
    sort_order: number;
  }[] = [];

  for (let i = 0; i < list.length; i++) {
    const row = (list[i] || {}) as ManualItemInput;
    const name = asText(row.name);
    const qty = num(row.qty);
    if (!name || qty <= 0) continue;
    const productId = asText(row.product_id);
    out.push({
      name,
      qty,
      unit: asText(row.unit) || null,
      product_id: productId && isUuid(productId) ? productId : null,
      item_key: asText(row.item_key) || null,
      sort_order: i,
    });
  }

  return out;
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;
  const { user, orgId, actorRole } = auth;

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const sj_date = coerceDateOrToday(body.sj_date);
  const shipping_address = asText(body.shipping_address);
  const driver_name = asText(body.driver_name);
  const note = asText(body.note);
  const warehouse_id = asText(body.warehouse_id);
  const customer_id = asText(body.customer_id);
  let customer_name = asText(body.customer_name);
  let customer_phone = asText(body.customer_phone) || null;
  const invoice_id = asText(body.invoice_id);

  if (!shipping_address) {
    return NextResponse.json({ error: "Alamat pengiriman wajib diisi." }, { status: 400 });
  }

  if (customer_id) {
    if (!isUuid(customer_id)) {
      return NextResponse.json({ error: "Customer tidak valid." }, { status: 400 });
    }
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

  const items = normalizeItems(body.items);
  if (items.length === 0) {
    return NextResponse.json(
      { error: "Minimal satu item dengan nama dan qty lebih dari 0." },
      { status: 400 }
    );
  }

  let linkedInvoiceId: string | null = null;
  if (invoice_id) {
    if (!isUuid(invoice_id)) {
      return NextResponse.json({ error: "Invoice tidak valid." }, { status: 400 });
    }
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
    sj_date,
    shipping_address,
    driver_name: driver_name || "",
    note: note || "",
    warehouse_id: warehouse_id && isUuid(warehouse_id) ? warehouse_id : null,
    status: "draft",
    created_by: user.id,
  };

  const { data: createdDn, error: dnErr } = await supabase
    .from("delivery_notes")
    .insert(insertPayload)
    .select("id, sj_number, sj_date, status")
    .single();

  if (dnErr) {
    return NextResponse.json({ error: dnErr.message }, { status: 400 });
  }

  const deliveryNoteId = String(createdDn.id);
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
    await admin.from("delivery_notes").delete().eq("id", deliveryNoteId);
    return NextResponse.json({ error: itemsErr.message }, { status: 400 });
  }

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "delivery_note.create_manual",
    entity_type: "delivery_note",
    entity_id: deliveryNoteId,
    summary: `Buat Surat Jalan manual ${createdDn.sj_number || deliveryNoteId} untuk ${customer_name}`,
    meta: { delivery_note_id: deliveryNoteId, invoice_id: linkedInvoiceId },
  });

  return NextResponse.json({
    ok: true,
    id: deliveryNoteId,
    delivery_note: createdDn,
  });
}
