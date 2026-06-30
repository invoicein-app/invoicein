import type { SupabaseClient } from "@supabase/supabase-js";
import { asText } from "@/lib/api-context";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type DeliveryNoteRow = {
  id: string;
  status: string | null;
  warehouse_id: string | null;
};

type InvoiceItemRow = {
  name: string;
  qty: number;
  sort_order: number;
  product_id: string | null;
  item_key: string | null;
  unit: string | null;
};

async function loadProductUnitMap(
  admin: SupabaseClient,
  items: InvoiceItemRow[]
): Promise<Map<string, string | null>> {
  const productIds = [
    ...new Set(items.map((it) => asText(it.product_id)).filter(Boolean)),
  ];

  if (productIds.length === 0) {
    return new Map();
  }

  const { data: products, error: prodErr } = await admin
    .from("products")
    .select("id, unit")
    .in("id", productIds);

  if (prodErr) {
    throw new Error(prodErr.message);
  }

  return new Map(
    (products || []).map((p: { id: string; unit: string | null }) => [
      String(p.id),
      asText(p.unit) || null,
    ])
  );
}

async function reverseDeliveryNoteStockForResync(args: {
  supabase: SupabaseClient;
  orgId: string;
  deliveryNoteId: string;
  warehouseId: string;
}): Promise<{ ok: true; hadStock: boolean } | { ok: false; error: string }> {
  const { supabase, orgId, deliveryNoteId, warehouseId } = args;

  const { data: outLedgers, error: outLedgersErr } = await supabase
    .from("stock_ledger")
    .select("id, warehouse_id, product_id, ref_line_id, product_name, qty_out")
    .eq("org_id", orgId)
    .eq("ref_type", "DELIVERY_NOTE")
    .eq("ref_id", deliveryNoteId);

  if (outLedgersErr) {
    return { ok: false, error: outLedgersErr.message };
  }

  if (!outLedgers?.length) {
    return { ok: true, hadStock: false };
  }

  for (const row of outLedgers as Array<Record<string, unknown>>) {
    const whId = String(row.warehouse_id || warehouseId || "").trim();
    const productId = String(row.product_id || "").trim();
    const productName = String(row.product_name || "").trim();
    const qtyOut = Math.max(0, Math.floor(num(row.qty_out)));

    if (!whId || !productId || qtyOut <= 0) continue;

    const { data: bal, error: balErr } = await supabase
      .from("inventory_balances")
      .select("item_key, item_name, on_hand")
      .eq("org_id", orgId)
      .eq("warehouse_id", whId)
      .eq("product_id", productId)
      .maybeSingle();

    if (balErr) {
      return { ok: false, error: balErr.message };
    }

    if (!bal) {
      return {
        ok: false,
        error: `Balance stok untuk barang "${productName || productId}" tidak ditemukan.`,
      };
    }

    const nextOnHand = Math.max(0, Math.floor(num((bal as { on_hand?: unknown }).on_hand))) + qtyOut;

    const { error: upBalErr } = await supabase
      .from("inventory_balances")
      .upsert(
        {
          org_id: orgId,
          warehouse_id: whId,
          product_id: productId,
          item_key: String((bal as { item_key?: unknown }).item_key || "").trim(),
          item_name: String((bal as { item_name?: unknown }).item_name || productName).trim(),
          on_hand: nextOnHand,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,warehouse_id,item_key" }
      );

    if (upBalErr) {
      return { ok: false, error: upBalErr.message };
    }
  }

  const { error: delLedErr } = await supabase
    .from("stock_ledger")
    .delete()
    .eq("org_id", orgId)
    .eq("ref_type", "DELIVERY_NOTE")
    .eq("ref_id", deliveryNoteId);

  if (delLedErr) {
    return { ok: false, error: delLedErr.message };
  }

  return { ok: true, hadStock: true };
}

async function applyDeliveryNoteStockOut(args: {
  supabase: SupabaseClient;
  orgId: string;
  deliveryNoteId: string;
  warehouseId: string;
  items: Array<{
    id: string;
    product_id: string | null;
    item_key: string | null;
    name: string;
    qty: number;
  }>;
  allowNegativeStock: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, orgId, deliveryNoteId, warehouseId, items, allowNegativeStock } = args;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!String(it.product_id || "").trim()) {
      return {
        ok: false,
        error: `Item SJ baris ${i + 1} belum linked ke product.`,
      };
    }
    if (!String(it.item_key || "").trim()) {
      return {
        ok: false,
        error: `Item SJ baris ${i + 1} belum punya item_key.`,
      };
    }
    if (Math.max(0, Math.floor(num(it.qty))) <= 0) {
      return {
        ok: false,
        error: `Qty item SJ baris ${i + 1} harus > 0.`,
      };
    }
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const qty = Math.max(0, Math.floor(num(it.qty)));
    const productId = String(it.product_id || "").trim();

    const { data: bal, error: balErr } = await supabase
      .from("inventory_balances")
      .select("on_hand")
      .eq("org_id", orgId)
      .eq("warehouse_id", warehouseId)
      .eq("product_id", productId)
      .maybeSingle();

    if (balErr) {
      return { ok: false, error: balErr.message };
    }

    const currentOnHand =
      bal && bal.on_hand != null ? Math.floor(num((bal as { on_hand: unknown }).on_hand)) : 0;
    const nextOnHand = currentOnHand - qty;

    if (!allowNegativeStock && nextOnHand < 0) {
      return {
        ok: false,
        error: `Stok tidak cukup untuk item "${it.name}". Stok saat ini ${currentOnHand}, butuh ${qty}.`,
      };
    }
  }

  for (const it of items) {
    const itemId = String(it.id || "").trim();
    const productId = String(it.product_id || "").trim();
    const itemKey = String(it.item_key || "").trim();
    const itemName = String(it.name || "").trim();
    const qty = Math.max(0, Math.floor(num(it.qty)));

    const { data: bal, error: balErr } = await supabase
      .from("inventory_balances")
      .select("on_hand")
      .eq("org_id", orgId)
      .eq("warehouse_id", warehouseId)
      .eq("product_id", productId)
      .maybeSingle();

    if (balErr) {
      return { ok: false, error: balErr.message };
    }

    const currentOnHand =
      bal && bal.on_hand != null ? Math.floor(num((bal as { on_hand: unknown }).on_hand)) : 0;
    const nextOnHand = currentOnHand - qty;

    const { error: upBalErr } = await supabase
      .from("inventory_balances")
      .upsert(
        {
          org_id: orgId,
          warehouse_id: warehouseId,
          product_id: productId,
          item_key: itemKey,
          item_name: itemName,
          on_hand: nextOnHand,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,warehouse_id,item_key" }
      );

    if (upBalErr) {
      return { ok: false, error: upBalErr.message };
    }

    const { error: ledErr } = await supabase.from("stock_ledger").insert({
      org_id: orgId,
      warehouse_id: warehouseId,
      product_id: productId,
      ref_type: "DELIVERY_NOTE",
      ref_id: deliveryNoteId,
      ref_line_id: itemId,
      product_name: itemName,
      qty_in: 0,
      qty_out: qty,
    });

    if (ledErr) {
      return { ok: false, error: ledErr.message };
    }
  }

  return { ok: true };
}

/** Keep linked surat jalan in sync after invoice header/items are saved. */
export async function resyncDeliveryNoteFromInvoiceAfterEdit(args: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  orgId: string;
  invoiceId: string;
}): Promise<{ ok: true; synced: boolean; deliveryNoteId?: string } | { ok: false; error: string }> {
  const { supabase, admin, orgId, invoiceId } = args;

  const { data: dn, error: dnErr } = await supabase
    .from("delivery_notes")
    .select("id, status, warehouse_id")
    .eq("org_id", orgId)
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dnErr) {
    return { ok: false, error: dnErr.message };
  }

  if (!dn?.id) {
    return { ok: true, synced: false };
  }

  const dnRow = dn as DeliveryNoteRow;
  const dnStatus = String(dnRow.status || "").toLowerCase();
  if (dnStatus === "cancelled") {
    return { ok: true, synced: false };
  }

  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .select("customer_id, customer_name, customer_phone, customer_address, warehouse_id")
    .eq("id", invoiceId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (invErr) {
    return { ok: false, error: invErr.message };
  }
  if (!inv) {
    return { ok: false, error: "Invoice tidak ditemukan." };
  }

  const { data: invoiceItems, error: itemsErr } = await supabase
    .from("invoice_items")
    .select("name, qty, sort_order, product_id, item_key, unit")
    .eq("invoice_id", invoiceId)
    .order("sort_order", { ascending: true });

  if (itemsErr) {
    return { ok: false, error: itemsErr.message };
  }

  const items = (invoiceItems || []) as InvoiceItemRow[];
  const warehouseId = String(inv.warehouse_id || dnRow.warehouse_id || "").trim() || null;

  const { data: settings, error: settingsErr } = await supabase
    .from("org_settings")
    .select("allow_negative_stock, stock_issue_trigger, inventory_enabled")
    .eq("org_id", orgId)
    .maybeSingle();

  if (settingsErr) {
    return { ok: false, error: settingsErr.message };
  }

  const stockIssueTrigger = String(settings?.stock_issue_trigger || "invoice_sent");
  const shouldMoveStock =
    stockIssueTrigger === "delivery_note_posted" &&
    dnStatus === "posted" &&
    Boolean(warehouseId);

  if (shouldMoveStock && warehouseId) {
    const reversed = await reverseDeliveryNoteStockForResync({
      supabase,
      orgId,
      deliveryNoteId: dnRow.id,
      warehouseId,
    });
    if (!reversed.ok) {
      return reversed;
    }
  }

  const { error: upDnErr } = await supabase
    .from("delivery_notes")
    .update({
      customer_id: asText(inv.customer_id) || null,
      customer_name: asText(inv.customer_name) || "",
      customer_phone: asText(inv.customer_phone) || null,
      shipping_address: String(inv.customer_address || ""),
      warehouse_id: warehouseId,
    })
    .eq("id", dnRow.id)
    .eq("org_id", orgId);

  if (upDnErr) {
    return { ok: false, error: upDnErr.message };
  }

  const { error: delItemsErr } = await admin
    .from("delivery_note_items")
    .delete()
    .eq("delivery_note_id", dnRow.id);

  if (delItemsErr) {
    return { ok: false, error: delItemsErr.message };
  }

  let insertedItems: Array<{
    id: string;
    product_id: string | null;
    item_key: string | null;
    name: string;
    qty: number;
  }> = [];

  if (items.length > 0) {
    let productUnitMap: Map<string, string | null>;
    try {
      productUnitMap = await loadProductUnitMap(admin, items);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal memuat product.";
      return { ok: false, error: msg };
    }

    const payload = items.map((it, i) => {
      const productId = asText(it.product_id) || null;
      const unitFromInvoice = asText(it.unit) || null;
      const unitFromProduct = productId ? productUnitMap.get(productId) || null : null;

      return {
        delivery_note_id: dnRow.id,
        name: String(it.name || ""),
        qty: Math.max(0, num(it.qty)),
        sort_order: it.sort_order ?? i,
        unit: unitFromInvoice || unitFromProduct || null,
        product_id: productId,
        item_key: asText(it.item_key) || null,
      };
    });

    const { data: rows, error: insItemsErr } = await admin
      .from("delivery_note_items")
      .insert(payload)
      .select("id, product_id, item_key, name, qty");

    if (insItemsErr) {
      return { ok: false, error: insItemsErr.message };
    }

    insertedItems = (rows || []) as typeof insertedItems;
  }

  if (shouldMoveStock && warehouseId && insertedItems.length > 0) {
    const allowNegativeStock =
      typeof settings?.allow_negative_stock === "boolean" ? !!settings.allow_negative_stock : true;

    const applied = await applyDeliveryNoteStockOut({
      supabase,
      orgId,
      deliveryNoteId: dnRow.id,
      warehouseId,
      items: insertedItems,
      allowNegativeStock,
    });

    if (!applied.ok) {
      return applied;
    }
  }

  return { ok: true, synced: true, deliveryNoteId: dnRow.id };
}
