import type { SupabaseClient } from "@supabase/supabase-js";

export type ItemReferenceType = "product" | "manual";

export type LatestPriceLine = {
  product_id?: string | null;
  item_key?: string | null;
  price: number;
  invoice_item_id?: string | null;
};

export function normalizeItemKey(raw: string): string {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "";
}

export function resolveItemReference(args: {
  product_id?: string | null;
  item_key?: string | null;
}): {
  item_reference_type: ItemReferenceType;
  product_id: string | null;
  item_key: string | null;
  matching_key: string;
} | null {
  const productId = String(args.product_id || "").trim();
  if (productId) {
    return {
      item_reference_type: "product",
      product_id: productId,
      item_key: null,
      matching_key: `p:${productId}`,
    };
  }

  const itemKey = normalizeItemKey(String(args.item_key || ""));
  if (!itemKey) return null;

  return {
    item_reference_type: "manual",
    product_id: null,
    item_key: itemKey,
    matching_key: `m:${itemKey}`,
  };
}

function floorPrice(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export async function lookupLatestPriceFromHistory(args: {
  supabase: SupabaseClient;
  orgId: string;
  customerId: string;
  productId: string;
}): Promise<number | null> {
  const { supabase, orgId, customerId, productId } = args;

  const { data: invoices, error: invErr } = await supabase
    .from("invoices")
    .select("id, invoice_date, created_at")
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .neq("status", "cancelled")
    .order("invoice_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (invErr || !invoices?.length) return null;

  const invoiceOrder = new Map(
    invoices.map((inv, idx) => [String((inv as any).id), idx])
  );
  const invoiceIds = invoices.map((inv) => String((inv as any).id));

  const { data: items, error: itemErr } = await supabase
    .from("invoice_items")
    .select("price, invoice_id, product_id")
    .in("invoice_id", invoiceIds)
    .eq("product_id", productId);

  if (itemErr || !items?.length) return null;

  let best: { rank: number; price: number } | null = null;
  for (const row of items) {
    const invId = String((row as any).invoice_id || "");
    const rank = invoiceOrder.get(invId);
    if (rank == null) continue;
    const price = floorPrice((row as any).price);
    if (price <= 0) continue;
    if (!best || rank < best.rank) best = { rank, price };
  }

  return best?.price ?? null;
}

export async function lookupCustomerLatestPrice(args: {
  supabase: SupabaseClient;
  orgId: string;
  customerId: string;
  productId?: string | null;
  itemKey?: string | null;
  useHistoryFallback?: boolean;
}): Promise<number | null> {
  const ref = resolveItemReference({
    product_id: args.productId,
    item_key: args.itemKey,
  });
  if (!ref) return null;

  const { data, error } = await args.supabase
    .from("customer_item_latest_prices")
    .select("latest_price")
    .eq("org_id", args.orgId)
    .eq("customer_id", args.customerId)
    .eq("matching_key", ref.matching_key)
    .maybeSingle();

  if (!error && data) {
    const price = floorPrice((data as any).latest_price);
    if (price > 0) return price;
  }

  if (args.useHistoryFallback !== false && ref.item_reference_type === "product" && ref.product_id) {
    return lookupLatestPriceFromHistory({
      supabase: args.supabase,
      orgId: args.orgId,
      customerId: args.customerId,
      productId: ref.product_id,
    });
  }

  if (args.useHistoryFallback !== false && ref.item_reference_type === "manual" && ref.item_key) {
    return lookupLatestPriceFromHistoryByItemKey({
      supabase: args.supabase,
      orgId: args.orgId,
      customerId: args.customerId,
      itemKey: ref.item_key,
    });
  }

  return null;
}

export async function lookupLatestPriceFromHistoryByItemKey(args: {
  supabase: SupabaseClient;
  orgId: string;
  customerId: string;
  itemKey: string;
}): Promise<number | null> {
  const { supabase, orgId, customerId, itemKey } = args;
  const normalized = normalizeItemKey(itemKey);
  if (!normalized) return null;

  const { data: invoices, error: invErr } = await supabase
    .from("invoices")
    .select("id, invoice_date, created_at")
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .neq("status", "cancelled")
    .order("invoice_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (invErr || !invoices?.length) return null;

  const invoiceOrder = new Map(
    invoices.map((inv, idx) => [String((inv as any).id), idx])
  );
  const invoiceIds = invoices.map((inv) => String((inv as any).id));

  const { data: items, error: itemErr } = await supabase
    .from("invoice_items")
    .select("price, invoice_id, item_key, product_id")
    .in("invoice_id", invoiceIds)
    .eq("item_key", normalized);

  if (itemErr || !items?.length) return null;

  let best: { rank: number; price: number } | null = null;
  for (const row of items) {
    if (String((row as any).product_id || "").trim()) continue;
    const invId = String((row as any).invoice_id || "");
    const rank = invoiceOrder.get(invId);
    if (rank == null) continue;
    const price = floorPrice((row as any).price);
    if (price <= 0) continue;
    if (!best || rank < best.rank) best = { rank, price };
  }

  return best?.price ?? null;
}

export async function lookupCustomerLatestManualPriceMap(args: {
  supabase: SupabaseClient;
  orgId: string;
  customerId: string;
  itemKeys?: string[];
  useHistoryFallback?: boolean;
}): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const customerId = String(args.customerId || "").trim();
  if (!customerId) return out;

  const keys = Array.from(
    new Set((args.itemKeys || []).map((k) => normalizeItemKey(k)).filter(Boolean))
  );
  if (keys.length === 0) return out;

  const { data: rows } = await args.supabase
    .from("customer_item_latest_prices")
    .select("item_key, latest_price, matching_key")
    .eq("org_id", args.orgId)
    .eq("customer_id", customerId)
    .eq("item_reference_type", "manual")
    .in("item_key", keys);

  for (const row of rows || []) {
    const key = normalizeItemKey(String((row as any).item_key || ""));
    const price = floorPrice((row as any).latest_price);
    if (key && price > 0) out[key] = price;
  }

  if (args.useHistoryFallback === false) return out;

  await Promise.all(
    keys.filter((k) => out[k] == null).map(async (itemKey) => {
      const hist = await lookupLatestPriceFromHistoryByItemKey({
        supabase: args.supabase,
        orgId: args.orgId,
        customerId,
        itemKey,
      });
      if (hist != null) out[itemKey] = hist;
    })
  );

  return out;
}

export async function lookupCustomerLatestPriceMap(args: {
  supabase: SupabaseClient;
  orgId: string;
  customerId: string;
  productIds?: string[];
  useHistoryFallback?: boolean;
}): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const customerId = String(args.customerId || "").trim();
  if (!customerId) return out;

  let query = args.supabase
    .from("customer_item_latest_prices")
    .select("product_id, latest_price, matching_key")
    .eq("org_id", args.orgId)
    .eq("customer_id", customerId)
    .eq("item_reference_type", "product");

  const filterIds = (args.productIds || []).map((x) => String(x || "").trim()).filter(Boolean);
  if (filterIds.length > 0) {
    query = query.in("product_id", filterIds);
  }

  const { data: rows } = await query;
  for (const row of rows || []) {
    const pid = String((row as any).product_id || "").trim();
    const price = floorPrice((row as any).latest_price);
    if (pid && price > 0) out[pid] = price;
  }

  if (args.useHistoryFallback === false) return out;

  const missing = filterIds.filter((pid) => out[pid] == null);
  if (missing.length === 0) return out;

  await Promise.all(
    missing.map(async (productId) => {
      const hist = await lookupLatestPriceFromHistory({
        supabase: args.supabase,
        orgId: args.orgId,
        customerId,
        productId,
      });
      if (hist != null) out[productId] = hist;
    })
  );

  return out;
}

export async function upsertCustomerLatestPrices(args: {
  supabase: SupabaseClient;
  orgId: string;
  customerId: string | null | undefined;
  lines: LatestPriceLine[];
}): Promise<void> {
  const customerId = String(args.customerId || "").trim();
  if (!customerId || args.lines.length === 0) return;

  const now = new Date().toISOString();
  const payload: Record<string, unknown>[] = [];

  for (const line of args.lines) {
    const ref = resolveItemReference({
      product_id: line.product_id,
      item_key: line.item_key,
    });
    if (!ref) continue;

    const price = floorPrice(line.price);
    if (price <= 0) continue;

    payload.push({
      org_id: args.orgId,
      customer_id: customerId,
      item_reference_type: ref.item_reference_type,
      product_id: ref.product_id,
      item_key: ref.item_key,
      matching_key: ref.matching_key,
      latest_price: price,
      last_source_invoice_item_id: line.invoice_item_id || null,
      updated_at: now,
    });
  }

  if (payload.length === 0) return;

  const { error } = await args.supabase
    .from("customer_item_latest_prices")
    .upsert(payload, { onConflict: "org_id,customer_id,matching_key" });

  if (error) {
    console.warn("upsertCustomerLatestPrices failed:", error.message);
  }
}
