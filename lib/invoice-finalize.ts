import type { SupabaseClient } from "@supabase/supabase-js";
import { logActivity } from "@/lib/log-activity";

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type InvoiceFinalizeResult =
  | { ok: true; status: "sent"; stock_moved: boolean; reason?: string }
  | { ok: false; error: string; status?: number };

type InvoiceRow = {
  id: string;
  org_id: string;
  status?: string | null;
  warehouse_id?: string | null;
  invoice_number?: string | null;
  customer_name?: string | null;
};

type InvoiceItemRow = {
  id: string;
  product_id: string | null;
  item_key: string | null;
  name: string | null;
  qty: number | null;
  price: number | null;
};

/** Finalize invoice = status sent (+ stock when org trigger = invoice_sent). */
export async function finalizeInvoice(args: {
  supabase: SupabaseClient;
  orgId: string;
  invoiceId: string;
  userId: string;
  actorRole: string;
  /** Legacy draft via Send button — skip if already sent. */
  fromLegacySend?: boolean;
  activityAction?: string;
}): Promise<InvoiceFinalizeResult> {
  const {
    supabase,
    orgId,
    invoiceId,
    userId,
    actorRole,
    fromLegacySend = false,
    activityAction = "invoice.sent",
  } = args;

  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .select("id, org_id, status, warehouse_id, invoice_number, customer_name")
    .eq("id", invoiceId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (invErr) return { ok: false, error: invErr.message };
  if (!inv) return { ok: false, error: "Invoice not found", status: 404 };

  const currentStatus = String((inv as InvoiceRow).status || "").toLowerCase();
  if (fromLegacySend) {
    if (currentStatus === "sent" || currentStatus === "paid") {
      return { ok: false, error: "Invoice sudah pernah dikirim / diposting." };
    }
    if (currentStatus === "cancelled") {
      return { ok: false, error: "Invoice cancelled tidak bisa dikirim." };
    }
  } else if (currentStatus === "sent" || currentStatus === "paid") {
    return { ok: true, status: "sent", stock_moved: false, reason: "already_finalized" };
  } else if (currentStatus === "cancelled") {
    return { ok: false, error: "Invoice cancelled tidak bisa difinalisasi." };
  }

  const { data: settings, error: settingsErr } = await supabase
    .from("org_settings")
    .select("allow_negative_stock, stock_issue_trigger, inventory_enabled")
    .eq("org_id", orgId)
    .maybeSingle();

  if (settingsErr) return { ok: false, error: settingsErr.message };

  const inventoryEnabled = Boolean(settings?.inventory_enabled);

  const allowNegativeStock =
    typeof settings?.allow_negative_stock === "boolean" ? !!settings.allow_negative_stock : true;

  const stockIssueTrigger = String(settings?.stock_issue_trigger || "invoice_sent");

  const { data: items, error: itemErr } = await supabase
    .from("invoice_items")
    .select("id, product_id, item_key, name, qty, price")
    .eq("invoice_id", invoiceId)
    .order("sort_order", { ascending: true });

  if (itemErr) return { ok: false, error: itemErr.message };
  if (!items?.length) return { ok: false, error: "Invoice tidak punya item." };

  for (let i = 0; i < items.length; i++) {
    const it = items[i] as InvoiceItemRow;
    if (!String(it.name || "").trim()) {
      return { ok: false, error: `Item baris ${i + 1}: nama wajib diisi.` };
    }
    if (inventoryEnabled) {
      if (!String(it.product_id || "").trim()) {
        return { ok: false, error: `Item baris ${i + 1} belum linked ke product.` };
      }
      if (!String(it.item_key || "").trim()) {
        return { ok: false, error: `Item baris ${i + 1} belum punya item_key.` };
      }
    }
    if (Math.max(0, num(it.qty)) <= 0) {
      return { ok: false, error: `Qty item baris ${i + 1} harus > 0.` };
    }
  }

  const markSent = async (meta: Record<string, unknown>) => {
    const { error: upErr } = await supabase
      .from("invoices")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", invoiceId)
      .eq("org_id", orgId);

    if (upErr) return { ok: false as const, error: upErr.message };

    await logActivity({
      org_id: orgId,
      actor_user_id: userId,
      actor_role: actorRole,
      action: activityAction,
      entity_type: "invoice",
      entity_id: invoiceId,
      summary: `Finalize invoice ${String((inv as InvoiceRow).invoice_number || invoiceId)}`,
      meta: {
        invoice_id: invoiceId,
        invoice_number: (inv as InvoiceRow).invoice_number || null,
        customer_name: (inv as InvoiceRow).customer_name || null,
        stock_issue_trigger: stockIssueTrigger,
        ...meta,
      },
    });

    return { ok: true as const };
  };

  if (!inventoryEnabled) {
    const r = await markSent({ stock_movement: "skipped", reason: "inventory disabled" });
    if (!r.ok) return r;
    return {
      ok: true,
      status: "sent",
      stock_moved: false,
      reason: "inventory disabled",
    };
  }

  if (stockIssueTrigger !== "invoice_sent") {
    const r = await markSent({ stock_movement: "skipped", reason: "trigger is not invoice_sent" });
    if (!r.ok) return r;
    return {
      ok: true,
      status: "sent",
      stock_moved: false,
      reason: "stock_issue_trigger is not invoice_sent",
    };
  }

  const warehouseId = String((inv as InvoiceRow).warehouse_id || "").trim();
  if (!warehouseId) {
    const r = await markSent({ stock_movement: "skipped", reason: "warehouse_id is null" });
    if (!r.ok) return r;
    return { ok: true, status: "sent", stock_moved: false, reason: "warehouse_id empty" };
  }

  const { data: existingLedger, error: existingLedgerErr } = await supabase
    .from("stock_ledger")
    .select("id")
    .eq("org_id", orgId)
    .eq("ref_type", "INVOICE")
    .eq("ref_id", invoiceId)
    .limit(1)
    .maybeSingle();

  if (existingLedgerErr) return { ok: false, error: existingLedgerErr.message };
  if (existingLedger) {
    const r = await markSent({ stock_movement: "skipped", reason: "ledger already exists" });
    if (!r.ok) return r;
    return { ok: true, status: "sent", stock_moved: false, reason: "stock already posted" };
  }

  const stockApply = await applyInvoiceStockOut({
    supabase,
    orgId,
    invoiceId,
    warehouseId,
    items: items as InvoiceItemRow[],
    allowNegativeStock,
  });

  if (!stockApply.ok) return stockApply;

  const r = await markSent({
    warehouse_id: warehouseId,
    stock_moved: true,
    items_count: items.length,
    allow_negative_stock: allowNegativeStock,
  });
  if (!r.ok) return r;

  return {
    ok: true,
    status: "sent",
    stock_moved: true,
  };
}

/** Restore stock from INVOICE ledger rows (for cancel / edit recalc). */
export async function reverseInvoiceStockOut(args: {
  supabase: SupabaseClient;
  orgId: string;
  invoiceId: string;
  reversalRefType: "INVOICE_CANCEL" | "INVOICE_EDIT";
  warehouseFallback?: string;
  /** Edit may run multiple times — skip one-time reversal guard. */
  allowRepeat?: boolean;
}): Promise<{ ok: true; reversed: number } | { ok: false; error: string }> {
  const { supabase, orgId, invoiceId, reversalRefType, warehouseFallback = "", allowRepeat = false } = args;

  const { data: outLedgers, error: ledErr } = await supabase
    .from("stock_ledger")
    .select("id, warehouse_id, product_id, ref_line_id, product_name, qty_out")
    .eq("org_id", orgId)
    .eq("ref_type", "INVOICE")
    .eq("ref_id", invoiceId);

  if (ledErr) return { ok: false, error: ledErr.message };
  if (!outLedgers?.length) return { ok: true, reversed: 0 };

  if (!allowRepeat) {
    const { data: existingRev } = await supabase
      .from("stock_ledger")
      .select("id")
      .eq("org_id", orgId)
      .eq("ref_type", reversalRefType)
      .eq("ref_id", invoiceId)
      .limit(1)
      .maybeSingle();

    if (existingRev) {
      return { ok: false, error: `Reversal stok (${reversalRefType}) sudah pernah diposting.` };
    }
  }

  for (const row of outLedgers as any[]) {
    const whId = String(row.warehouse_id || warehouseFallback || "").trim();
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

    if (balErr) return { ok: false, error: balErr.message };
    if (!bal) {
      return { ok: false, error: `Balance stok untuk barang "${productName}" tidak ditemukan.` };
    }

    const nextOnHand = Math.max(0, Math.floor(num((bal as any).on_hand))) + qtyOut;

    const { error: upBalErr } = await supabase
      .from("inventory_balances")
      .upsert(
        {
          org_id: orgId,
          warehouse_id: whId,
          product_id: productId,
          item_key: String((bal as any).item_key || "").trim(),
          item_name: String((bal as any).item_name || productName).trim(),
          on_hand: nextOnHand,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,warehouse_id,item_key" }
      );

    if (upBalErr) return { ok: false, error: upBalErr.message };

    const { error: revLedErr } = await supabase.from("stock_ledger").insert({
      org_id: orgId,
      warehouse_id: whId,
      product_id: productId,
      ref_type: reversalRefType,
      ref_id: invoiceId,
      ref_line_id: String(row.ref_line_id || row.id || ""),
      product_name: productName,
      qty_in: qtyOut,
      qty_out: 0,
    });

    if (revLedErr) return { ok: false, error: revLedErr.message };
  }

  await supabase
    .from("stock_ledger")
    .delete()
    .eq("org_id", orgId)
    .eq("ref_type", "INVOICE")
    .eq("ref_id", invoiceId);

  return { ok: true, reversed: outLedgers.length };
}

export async function applyInvoiceStockOut(args: {
  supabase: SupabaseClient;
  orgId: string;
  invoiceId: string;
  warehouseId: string;
  items: InvoiceItemRow[];
  allowNegativeStock: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, orgId, invoiceId, warehouseId, items, allowNegativeStock } = args;

  const stockItems = items.filter((it) => String(it.product_id || "").trim());
  if (stockItems.length === 0) {
    return { ok: true };
  }

  for (let i = 0; i < stockItems.length; i++) {
    const it = stockItems[i];
    const qty = Math.max(0, num(it.qty));
    const productId = String(it.product_id || "").trim();
    const itemKey = String(it.item_key || "").trim();
    const itemName = String(it.name || "").trim();

    const { data: bal, error: balErr } = await supabase
      .from("inventory_balances")
      .select("on_hand")
      .eq("org_id", orgId)
      .eq("warehouse_id", warehouseId)
      .eq("product_id", productId)
      .maybeSingle();

    if (balErr) return { ok: false, error: balErr.message };

    const currentOnHand =
      bal && bal.on_hand != null ? Math.floor(num((bal as any).on_hand)) : 0;
    const nextOnHand = currentOnHand - qty;

    if (!allowNegativeStock && nextOnHand < 0) {
      return {
        ok: false,
        error: `Stok tidak cukup untuk item "${itemName || itemKey}". Stok saat ini ${currentOnHand}, butuh ${qty}.`,
      };
    }
  }

  for (const it of stockItems) {
    const itemId = String(it.id || "").trim();
    const productId = String(it.product_id || "").trim();
    const itemKey = String(it.item_key || "").trim();
    const itemName = String(it.name || "").trim();
    const qty = Math.max(0, num(it.qty));

    const { data: bal, error: balErr } = await supabase
      .from("inventory_balances")
      .select("on_hand")
      .eq("org_id", orgId)
      .eq("warehouse_id", warehouseId)
      .eq("product_id", productId)
      .maybeSingle();

    if (balErr) return { ok: false, error: balErr.message };

    const currentOnHand =
      bal && bal.on_hand != null ? Math.floor(num((bal as any).on_hand)) : 0;
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

    if (upBalErr) return { ok: false, error: upBalErr.message };

    const { error: ledErr } = await supabase.from("stock_ledger").insert({
      org_id: orgId,
      warehouse_id: warehouseId,
      product_id: productId,
      ref_type: "INVOICE",
      ref_id: invoiceId,
      ref_line_id: itemId,
      product_name: itemName,
      qty_in: 0,
      qty_out: qty,
    });

    if (ledErr) return { ok: false, error: ledErr.message };
  }

  return { ok: true };
}

/** After item edit on a sent invoice — recalc stock if trigger = invoice_sent. */
export async function resyncInvoiceStockAfterEdit(args: {
  supabase: SupabaseClient;
  orgId: string;
  invoiceId: string;
  warehouseId: string | null;
}): Promise<{ ok: true; stock_moved: boolean } | { ok: false; error: string }> {
  const { supabase, orgId, invoiceId, warehouseId } = args;

  const { data: settings } = await supabase
    .from("org_settings")
    .select("allow_negative_stock, stock_issue_trigger, inventory_enabled")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!settings?.inventory_enabled) {
    return { ok: true, stock_moved: false };
  }

  const stockIssueTrigger = String(settings?.stock_issue_trigger || "invoice_sent");
  if (stockIssueTrigger !== "invoice_sent") {
    return { ok: true, stock_moved: false };
  }

  const wh = String(warehouseId || "").trim();
  if (!wh) return { ok: true, stock_moved: false };

  const { data: hadLedger } = await supabase
    .from("stock_ledger")
    .select("id")
    .eq("org_id", orgId)
    .eq("ref_type", "INVOICE")
    .eq("ref_id", invoiceId)
    .limit(1)
    .maybeSingle();

  if (hadLedger) {
    const rev = await reverseInvoiceStockOut({
      supabase,
      orgId,
      invoiceId,
      reversalRefType: "INVOICE_EDIT",
      warehouseFallback: wh,
      allowRepeat: true,
    });
    if (!rev.ok) return rev;
  }

  const { data: items, error: itemErr } = await supabase
    .from("invoice_items")
    .select("id, product_id, item_key, name, qty, price")
    .eq("invoice_id", invoiceId)
    .order("sort_order", { ascending: true });

  if (itemErr) return { ok: false, error: itemErr.message };
  if (!items?.length) return { ok: false, error: "Invoice tidak punya item." };

  const allowNegativeStock =
    typeof settings?.allow_negative_stock === "boolean" ? !!settings.allow_negative_stock : true;

  const apply = await applyInvoiceStockOut({
    supabase,
    orgId,
    invoiceId,
    warehouseId: wh,
    items: items as InvoiceItemRow[],
    allowNegativeStock,
  });

  if (!apply.ok) return apply;
  return { ok: true, stock_moved: true };
}

export function deriveInvoiceStatusAfterEdit(args: {
  currentStatus: string;
  amountPaid: number;
  newTotal: number;
}): string {
  const st = String(args.currentStatus || "").toLowerCase();
  const paid = Math.max(0, Math.floor(num(args.amountPaid)));
  const total = Math.max(0, Math.floor(num(args.newTotal)));

  if (st === "cancelled") return "cancelled";
  if (st === "draft") return "draft";

  if (total > 0 && paid >= total) return "paid";
  return "sent";
}

export function canEditInvoice(args: {
  status: string;
  amountPaid?: number;
}): { allowed: boolean; reason?: string } {
  const st = String(args.status || "").toLowerCase();

  if (st === "cancelled") {
    return { allowed: false, reason: "Invoice sudah dibatalkan." };
  }
  if (st === "draft" || st === "sent" || st === "paid") {
    return { allowed: true };
  }
  return { allowed: false, reason: "Status invoice tidak mendukung edit." };
}
