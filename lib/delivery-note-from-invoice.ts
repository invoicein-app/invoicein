import type { SupabaseClient } from "@supabase/supabase-js";
import { asText } from "@/lib/api-context";

export type LinkedDeliveryNoteRow = {
  id: string;
  status: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Find the newest SJ linked to an invoice (avoids maybeSingle errors when duplicates exist). */
export async function findDeliveryNoteForInvoice(
  client: SupabaseClient,
  orgId: string,
  invoiceId: string
): Promise<{ ok: true; dn: LinkedDeliveryNoteRow | null } | { ok: false; error: string }> {
  const { data, error } = await client
    .from("delivery_notes")
    .select("id, status")
    .eq("org_id", orgId)
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    return { ok: false, error: error.message };
  }

  const row = data?.[0];
  if (!row?.id) {
    return { ok: true, dn: null };
  }

  return {
    ok: true,
    dn: {
      id: String(row.id),
      status: (row as { status?: string | null }).status ?? null,
    },
  };
}

/** Retry lookup after duplicate insert (concurrent create or replication lag). */
export async function findDeliveryNoteForInvoiceWithRetry(
  client: SupabaseClient,
  orgId: string,
  invoiceId: string
): Promise<{ ok: true; dn: LinkedDeliveryNoteRow | null } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const found = await findDeliveryNoteForInvoice(client, orgId, invoiceId);
    if (!found.ok) return found;
    if (found.dn) return found;
    if (attempt < 2) await sleep(120);
  }

  const { data, error } = await client
    .from("delivery_notes")
    .select("id, status")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    return { ok: false, error: error.message };
  }

  const row = data?.[0];
  if (!row?.id) {
    return { ok: true, dn: null };
  }

  return {
    ok: true,
    dn: {
      id: String(row.id),
      status: (row as { status?: string | null }).status ?? null,
    },
  };
}

export type InvoiceItemForDn = {
  name: string;
  qty: number;
  sort_order: number;
  product_id: string | null;
  item_key: string | null;
  unit: string | null;
};

export async function loadInvoiceItemsForDeliveryNote(
  admin: SupabaseClient,
  invoiceId: string
): Promise<{ ok: true; items: InvoiceItemForDn[] } | { ok: false; error: string }> {
  const { data: items, error: itemsErr } = await admin
    .from("invoice_items")
    .select("name, qty, sort_order, product_id, item_key, unit")
    .eq("invoice_id", invoiceId)
    .order("sort_order", { ascending: true });

  if (itemsErr) {
    return { ok: false, error: itemsErr.message };
  }

  return { ok: true, items: (items || []) as InvoiceItemForDn[] };
}

export async function buildDeliveryNoteItemPayload(
  admin: SupabaseClient,
  deliveryNoteId: string,
  items: InvoiceItemForDn[]
) {
  const productIds = [...new Set(items.map((it) => asText(it.product_id)).filter(Boolean))];

  let productUnitMap = new Map<string, string | null>();
  if (productIds.length > 0) {
    const { data: products, error: prodErr } = await admin
      .from("products")
      .select("id, unit")
      .in("id", productIds);

    if (prodErr) {
      throw new Error(prodErr.message);
    }

    productUnitMap = new Map(
      (products || []).map((p: { id: string; unit: string | null }) => [
        String(p.id),
        asText(p.unit) || null,
      ])
    );
  }

  return items.map((it, i) => {
    const productId = asText(it.product_id) || null;
    const unitFromInvoice = asText(it.unit) || null;
    const unitFromProduct = productId ? productUnitMap.get(productId) || null : null;

    return {
      delivery_note_id: deliveryNoteId,
      name: String(it.name || ""),
      qty: Number(it.qty || 0),
      sort_order: it.sort_order ?? i,
      unit: unitFromInvoice || unitFromProduct || null,
      product_id: productId,
      item_key: asText(it.item_key) || null,
    };
  });
}

export async function countDeliveryNoteItems(
  admin: SupabaseClient,
  deliveryNoteId: string
): Promise<number> {
  const { count, error } = await admin
    .from("delivery_note_items")
    .select("id", { count: "exact", head: true })
    .eq("delivery_note_id", deliveryNoteId);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}
