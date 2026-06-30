import type { SupabaseClient } from "@supabase/supabase-js";
import { rollbackDeliveryNoteCreate } from "@/lib/delivery-note-post";

type DeliveryNoteRow = {
  id: string;
  sj_number: string | null;
  status: string | null;
  warehouse_id: string | null;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function reverseDeliveryNoteStockIfNeeded(args: {
  supabase: SupabaseClient;
  orgId: string;
  deliveryNoteId: string;
  dn: DeliveryNoteRow;
  stockIssueTrigger: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, orgId, deliveryNoteId, dn, stockIssueTrigger } = args;
  const dnStatus = String(dn.status || "").toLowerCase();
  const warehouseId = String(dn.warehouse_id || "").trim();

  if (dnStatus === "draft" || dnStatus === "cancelled") {
    return { ok: true };
  }

  if (stockIssueTrigger !== "delivery_note_posted" || !warehouseId) {
    return { ok: true };
  }

  const { data: outLedgers, error: outLedgersErr } = await supabase
    .from("stock_ledger")
    .select("id, warehouse_id, product_id, ref_type, ref_id, ref_line_id, product_name, qty_in, qty_out")
    .eq("org_id", orgId)
    .eq("ref_type", "DELIVERY_NOTE")
    .eq("ref_id", deliveryNoteId);

  if (outLedgersErr) {
    return { ok: false, error: outLedgersErr.message };
  }

  if (!outLedgers?.length) {
    return { ok: true };
  }

  const { data: alreadyReversed, error: alreadyRevErr } = await supabase
    .from("stock_ledger")
    .select("id")
    .eq("org_id", orgId)
    .eq("ref_type", "DELIVERY_NOTE_CANCEL")
    .eq("ref_id", deliveryNoteId)
    .limit(1)
    .maybeSingle();

  if (alreadyRevErr) {
    return { ok: false, error: alreadyRevErr.message };
  }

  if (!alreadyReversed) {
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

      const currentOnHand = Math.max(0, Math.floor(num((bal as { on_hand?: unknown }).on_hand)));
      const nextOnHand = currentOnHand + qtyOut;

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

      const { error: ledErr } = await supabase.from("stock_ledger").insert({
        org_id: orgId,
        warehouse_id: whId,
        product_id: productId,
        ref_type: "DELIVERY_NOTE_CANCEL",
        ref_id: deliveryNoteId,
        ref_line_id: String(row.ref_line_id || row.id || ""),
        product_name: productName,
        qty_in: qtyOut,
        qty_out: 0,
      });

      if (ledErr) {
        return { ok: false, error: ledErr.message };
      }
    }
  }

  return { ok: true };
}

/** Remove all surat jalan linked to an invoice (reverse SJ stock first when needed). */
export async function deleteDeliveryNotesForInvoice(args: {
  supabase: SupabaseClient;
  orgId: string;
  invoiceId: string;
}): Promise<{ ok: true; deletedIds: string[] } | { ok: false; error: string }> {
  const { supabase, orgId, invoiceId } = args;

  const { data: dns, error: dnErr } = await supabase
    .from("delivery_notes")
    .select("id, sj_number, status, warehouse_id")
    .eq("org_id", orgId)
    .eq("invoice_id", invoiceId);

  if (dnErr) {
    return { ok: false, error: dnErr.message };
  }

  const rows = (dns || []) as DeliveryNoteRow[];
  if (rows.length === 0) {
    return { ok: true, deletedIds: [] };
  }

  const { data: settings, error: settingsErr } = await supabase
    .from("org_settings")
    .select("stock_issue_trigger")
    .eq("org_id", orgId)
    .maybeSingle();

  if (settingsErr) {
    return { ok: false, error: settingsErr.message };
  }

  const stockIssueTrigger = String(settings?.stock_issue_trigger || "invoice_sent");
  const deletedIds: string[] = [];

  for (const dn of rows) {
    const deliveryNoteId = String(dn.id || "").trim();
    if (!deliveryNoteId) continue;

    const reversed = await reverseDeliveryNoteStockIfNeeded({
      supabase,
      orgId,
      deliveryNoteId,
      dn,
      stockIssueTrigger,
    });

    if (!reversed.ok) {
      return reversed;
    }

    await supabase
      .from("stock_ledger")
      .delete()
      .eq("org_id", orgId)
      .eq("ref_id", deliveryNoteId)
      .in("ref_type", ["DELIVERY_NOTE", "DELIVERY_NOTE_CANCEL"]);

    await rollbackDeliveryNoteCreate(supabase, deliveryNoteId);
    deletedIds.push(deliveryNoteId);
  }

  return { ok: true, deletedIds };
}
