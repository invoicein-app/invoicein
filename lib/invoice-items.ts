import type { SupabaseClient } from "@supabase/supabase-js";
import { num } from "@/lib/money";

export function invoiceItemToKey(raw: string): string {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "";
}

export type NormalizedInvoiceItem = {
  product_id: string | null;
  name: string;
  item_key: string | null;
  qty: number;
  price: number;
  unit: string | null;
};

type ProductRow = {
  id: string;
  name?: string | null;
  sku?: string | null;
  unit?: string | null;
};

export function normalizeInvoiceItemInput(raw: unknown): NormalizedInvoiceItem {
  const r = raw as Record<string, unknown>;
  const product_id = String(r?.product_id || "").trim() || null;
  const name = String(r?.name || "").trim();
  const itemKeyRaw = String(r?.item_key || "").trim();
  let item_key = itemKeyRaw ? invoiceItemToKey(itemKeyRaw) : null;
  if (!item_key && name) item_key = invoiceItemToKey(name) || null;

  return {
    product_id,
    name,
    item_key,
    qty: Math.max(0, num(r?.qty)),
    price: Math.max(0, Math.floor(num(r?.price))),
    unit: null,
  };
}

export function validateInvoiceItems(args: {
  items: NormalizedInvoiceItem[];
  inventoryEnabled: boolean;
  productsById: Map<string, ProductRow>;
}): { ok: true; items: NormalizedInvoiceItem[] } | { ok: false; error: string } {
  const { items, inventoryEnabled, productsById } = args;

  if (items.length === 0) {
    return { ok: false, error: "Minimal 1 item." };
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i];

    if (!it.name) {
      return { ok: false, error: `Item baris ${i + 1}: nama wajib diisi.` };
    }
    if (!Number.isFinite(it.qty) || it.qty <= 0) {
      return { ok: false, error: `Item baris ${i + 1}: qty harus > 0.` };
    }

    if (inventoryEnabled) {
      if (!it.product_id) {
        return {
          ok: false,
          error: `Item baris ${i + 1} wajib pilih barang dari master karena fitur inventory aktif.`,
        };
      }
      if (!it.item_key) {
        return { ok: false, error: `Item baris ${i + 1} belum punya item_key.` };
      }

      const p = productsById.get(it.product_id);
      if (!p) {
        return { ok: false, error: `Item baris ${i + 1}: product tidak ditemukan.` };
      }

      const expectedKey = invoiceItemToKey(
        String(p.sku || "").trim() || String(p.name || "").trim()
      );

      if (it.item_key !== expectedKey) {
        return {
          ok: false,
          error: `Item baris ${i + 1}: item_key tidak cocok dengan product.`,
        };
      }

      if (it.name !== String(p.name || "").trim()) {
        return {
          ok: false,
          error: `Item baris ${i + 1}: nama item harus sama dengan master barang.`,
        };
      }

      it.unit = String(p.unit || "").trim() || null;
      continue;
    }

    if (it.product_id) {
      const p = productsById.get(it.product_id);
      if (p) {
        const expectedKey = invoiceItemToKey(
          String(p.sku || "").trim() || String(p.name || "").trim()
        );
        if (!it.item_key) it.item_key = expectedKey;
        it.unit = String(p.unit || "").trim() || null;
      } else {
        it.product_id = null;
        it.unit = null;
        it.item_key = invoiceItemToKey(it.name) || null;
      }
    } else {
      it.product_id = null;
      it.unit = null;
      it.item_key = invoiceItemToKey(it.name) || null;
    }
  }

  return { ok: true, items };
}

export async function loadOrgInventoryEnabled(
  supabase: SupabaseClient,
  orgId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("org_settings")
    .select("inventory_enabled")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) return false;
  return Boolean(data?.inventory_enabled);
}
