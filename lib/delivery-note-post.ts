import type { SupabaseClient } from "@supabase/supabase-js";
import { logActivity } from "@/lib/log-activity";

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type PostDeliveryNoteResult =
  | {
      ok: true;
      status: "posted";
      stock_moved: boolean;
      reason?: string;
      warehouse_id?: string;
      items_count?: number;
    }
  | { ok: false; error: string; status: number };

type DeliveryNoteRow = {
  id: string;
  org_id: string;
  invoice_id: string | null;
  sj_number: string | null;
  status: string | null;
  warehouse_id: string | null;
};

async function markDeliveryNotePosted(args: {
  supabase: SupabaseClient;
  orgId: string;
  deliveryNoteId: string;
  dnRow: DeliveryNoteRow;
  actorUserId: string;
  actorRole: string;
  stockIssueTrigger: string;
  stockMoved: boolean;
  reason: string;
  warehouseId?: string;
  itemsCount?: number;
  allowNegativeStock?: boolean;
}): Promise<PostDeliveryNoteResult> {
  const { error: upErr } = await args.supabase
    .from("delivery_notes")
    .update({
      status: "posted",
      posted_at: new Date().toISOString(),
    })
    .eq("id", args.deliveryNoteId)
    .eq("org_id", args.orgId);

  if (upErr) {
    return { ok: false, error: upErr.message, status: 400 };
  }

  await logActivity({
    org_id: args.orgId,
    actor_user_id: args.actorUserId,
    actor_role: args.actorRole,
    action: "delivery_note.post",
    entity_type: "delivery_note",
    entity_id: args.deliveryNoteId,
    summary: `Post delivery note ${String(args.dnRow.sj_number || args.deliveryNoteId)}`,
    meta: {
      delivery_note_id: args.deliveryNoteId,
      sj_number: args.dnRow.sj_number || null,
      stock_issue_trigger: args.stockIssueTrigger,
      stock_movement: args.stockMoved ? "applied" : "skipped",
      reason: args.reason,
      warehouse_id: args.warehouseId || null,
      stock_moved: args.stockMoved,
      items_count: args.itemsCount,
      allow_negative_stock: args.allowNegativeStock,
    },
  });

  return {
    ok: true,
    status: "posted",
    stock_moved: args.stockMoved,
    reason: args.reason,
    warehouse_id: args.warehouseId,
    items_count: args.itemsCount,
  };
}

export async function postDeliveryNote(args: {
  supabase: SupabaseClient;
  orgId: string;
  deliveryNoteId: string;
  actorUserId: string;
  actorRole: string;
}): Promise<PostDeliveryNoteResult> {
  const { supabase, orgId, deliveryNoteId, actorUserId, actorRole } = args;

  const { data: dn, error: dnErr } = await supabase
    .from("delivery_notes")
    .select("id, org_id, invoice_id, sj_number, status, warehouse_id")
    .eq("id", deliveryNoteId)
    .maybeSingle();

  if (dnErr) {
    return { ok: false, error: dnErr.message, status: 400 };
  }
  if (!dn) {
    return { ok: false, error: "Surat jalan tidak ditemukan.", status: 404 };
  }
  if (String((dn as DeliveryNoteRow).org_id || "") !== orgId) {
    return { ok: false, error: "Forbidden", status: 403 };
  }

  const dnRow = dn as DeliveryNoteRow;
  const dnStatus = String(dnRow.status || "draft").toLowerCase();

  if (dnStatus === "posted") {
    return { ok: false, error: "Surat jalan sudah dipost.", status: 400 };
  }
  if (dnStatus === "cancelled") {
    return { ok: false, error: "Surat jalan cancelled tidak bisa dipost.", status: 400 };
  }

  const { data: settings, error: settingsErr } = await supabase
    .from("org_settings")
    .select("allow_negative_stock, stock_issue_trigger")
    .eq("org_id", orgId)
    .maybeSingle();

  if (settingsErr) {
    return { ok: false, error: settingsErr.message, status: 400 };
  }

  const allowNegativeStock =
    typeof settings?.allow_negative_stock === "boolean" ? !!settings.allow_negative_stock : true;

  const stockIssueTrigger = String(settings?.stock_issue_trigger || "invoice_sent");
  const warehouseId = String(dnRow.warehouse_id || "").trim();

  const { data: items, error: itemsErr } = await supabase
    .from("delivery_note_items")
    .select("id, name, qty, product_id, item_key, sort_order")
    .eq("delivery_note_id", deliveryNoteId)
    .order("sort_order", { ascending: true });

  if (itemsErr) {
    return { ok: false, error: itemsErr.message, status: 400 };
  }
  if (!items || items.length === 0) {
    return { ok: false, error: "Surat jalan tidak punya item.", status: 400 };
  }

  if (stockIssueTrigger !== "delivery_note_posted") {
    return await markDeliveryNotePosted({
      supabase,
      orgId,
      deliveryNoteId,
      dnRow,
      actorUserId,
      actorRole,
      stockIssueTrigger,
      stockMoved: false,
      reason: "stock_issue_trigger is not delivery_note_posted",
    });
  }

  if (!warehouseId) {
    return await markDeliveryNotePosted({
      supabase,
      orgId,
      deliveryNoteId,
      dnRow,
      actorUserId,
      actorRole,
      stockIssueTrigger,
      stockMoved: false,
      reason: "warehouse_id empty",
    });
  }

  const { data: existingLedger, error: existingLedgerErr } = await supabase
    .from("stock_ledger")
    .select("id")
    .eq("org_id", orgId)
    .eq("warehouse_id", warehouseId)
    .eq("ref_type", "DELIVERY_NOTE")
    .eq("ref_id", deliveryNoteId)
    .limit(1)
    .maybeSingle();

  if (existingLedgerErr) {
    return { ok: false, error: existingLedgerErr.message, status: 400 };
  }

  if (existingLedger) {
    return {
      ok: false,
      error: "Stock movement surat jalan ini sudah pernah diposting.",
      status: 400,
    };
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i] as {
      product_id?: string | null;
      item_key?: string | null;
      qty?: number | null;
      name?: string | null;
    };
    if (!String(it.product_id || "").trim()) {
      return {
        ok: false,
        error: `Item baris ${i + 1} belum linked ke product.`,
        status: 400,
      };
    }
    if (!String(it.item_key || "").trim()) {
      return {
        ok: false,
        error: `Item baris ${i + 1} belum punya item_key.`,
        status: 400,
      };
    }
    if (Math.max(0, Math.floor(num(it.qty))) <= 0) {
      return {
        ok: false,
        error: `Qty item baris ${i + 1} harus > 0.`,
        status: 400,
      };
    }
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i] as {
      product_id?: string | null;
      qty?: number | null;
      name?: string | null;
      item_key?: string | null;
    };
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
      return { ok: false, error: balErr.message, status: 400 };
    }

    const currentOnHand =
      bal && bal.on_hand != null ? Math.floor(num((bal as { on_hand: unknown }).on_hand)) : 0;
    const nextOnHand = currentOnHand - qty;

    if (!allowNegativeStock && nextOnHand < 0) {
      return {
        ok: false,
        error: `Stok tidak cukup untuk item "${String(it.name || it.item_key)}". Stok saat ini ${currentOnHand}, butuh ${qty}.`,
        status: 400,
      };
    }
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i] as {
      id?: string;
      product_id?: string | null;
      item_key?: string | null;
      name?: string | null;
      qty?: number | null;
    };

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
      return { ok: false, error: balErr.message, status: 400 };
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
      return { ok: false, error: upBalErr.message, status: 400 };
    }

    const { error: ledErr } = await supabase
      .from("stock_ledger")
      .insert({
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
      return { ok: false, error: ledErr.message, status: 400 };
    }
  }

  const { error: postErr } = await supabase
    .from("delivery_notes")
    .update({
      status: "posted",
      posted_at: new Date().toISOString(),
    })
    .eq("id", deliveryNoteId)
    .eq("org_id", orgId);

  if (postErr) {
    return { ok: false, error: postErr.message, status: 400 };
  }

  await logActivity({
    org_id: orgId,
    actor_user_id: actorUserId,
    actor_role: actorRole,
    action: "delivery_note.post",
    entity_type: "delivery_note",
    entity_id: deliveryNoteId,
    summary: `Post delivery note ${String(dnRow.sj_number || deliveryNoteId)}`,
    meta: {
      delivery_note_id: deliveryNoteId,
      sj_number: dnRow.sj_number || null,
      warehouse_id: warehouseId,
      stock_issue_trigger: stockIssueTrigger,
      stock_moved: true,
      items_count: items.length,
      allow_negative_stock: allowNegativeStock,
    },
  });

  return {
    ok: true,
    status: "posted",
    stock_moved: true,
    warehouse_id: warehouseId,
    items_count: items.length,
  };
}

export async function rollbackDeliveryNoteCreate(
  admin: SupabaseClient,
  deliveryNoteId: string
): Promise<void> {
  await admin.from("delivery_note_items").delete().eq("delivery_note_id", deliveryNoteId);
  await admin.from("delivery_notes").delete().eq("id", deliveryNoteId);
}

export async function linkInvoiceToDeliveryNote(args: {
  admin: SupabaseClient;
  invoiceId: string;
  deliveryNoteId: string;
  sjNumber: string | null;
}): Promise<void> {
  const { admin, invoiceId, deliveryNoteId, sjNumber } = args;
  await admin
    .from("invoices")
    .update({
      delivery_note_id: deliveryNoteId,
      sj_number: sjNumber,
    })
    .eq("id", invoiceId);
}

export async function createAndFinalizeDeliveryNote(args: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  orgId: string;
  userId: string;
  actorRole: string;
  deliveryNoteId: string;
  invoiceId?: string | null;
}): Promise<PostDeliveryNoteResult> {
  const postResult = await postDeliveryNote({
    supabase: args.supabase,
    orgId: args.orgId,
    deliveryNoteId: args.deliveryNoteId,
    actorUserId: args.userId,
    actorRole: args.actorRole,
  });

  if (!postResult.ok) {
    await rollbackDeliveryNoteCreate(args.admin, args.deliveryNoteId);
    return postResult;
  }

  if (args.invoiceId) {
    const { data: dnRow } = await args.supabase
      .from("delivery_notes")
      .select("sj_number")
      .eq("id", args.deliveryNoteId)
      .maybeSingle();

    await linkInvoiceToDeliveryNote({
      admin: args.admin,
      invoiceId: args.invoiceId,
      deliveryNoteId: args.deliveryNoteId,
      sjNumber: (dnRow as { sj_number?: string | null } | null)?.sj_number ?? null,
    });
  }

  return postResult;
}
