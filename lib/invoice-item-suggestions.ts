import { invoiceItemToKey } from "@/lib/invoice-items";
import {
  buildManualItemSearchHaystack,
  buildProductSearchHaystack,
  itemSearchRelevance,
  manualItemMatchesItemSearch,
  productMatchesItemSearch,
} from "@/lib/item-search";

export type ProductSuggestionSource = {
  id: string;
  name: string;
  sku?: string | null;
  unit?: string | null;
  price?: number | null;
};

export type ManualSuggestionSource = {
  item_key: string;
  display_name: string;
  unit?: string | null;
};

export type ProductItemSuggestion = {
  kind: "product";
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  price: number | null;
};

export type ManualItemSuggestion = {
  kind: "manual";
  item_key: string;
  display_name: string;
  unit: string | null;
};

export type ItemSuggestion = ProductItemSuggestion | ManualItemSuggestion;

function productItemKey(p: ProductSuggestionSource): string {
  const sku = String(p.sku || "").trim();
  if (sku) return invoiceItemToKey(sku);
  return invoiceItemToKey(String(p.name || ""));
}

export function buildItemSuggestions(args: {
  query: string;
  products: ProductSuggestionSource[];
  manualItems: ManualSuggestionSource[];
  inventoryEnabled: boolean;
  limit?: number;
}): ItemSuggestion[] {
  const limit = Math.max(1, Math.floor(args.limit ?? 10));
  const query = String(args.query || "");

  const productMatches = (args.products || [])
    .filter((p) => productMatchesItemSearch(p, query))
    .sort((a, b) => {
      const relA = itemSearchRelevance({
        haystack: buildProductSearchHaystack(a),
        query,
        primaryText: a.name,
      });
      const relB = itemSearchRelevance({
        haystack: buildProductSearchHaystack(b),
        query,
        primaryText: b.name,
      });
      if (relA !== relB) return relA - relB;
      return String(a.name || "").localeCompare(String(b.name || ""), "id");
    })
    .slice(0, limit)
    .map(
      (p): ProductItemSuggestion => ({
        kind: "product",
        id: String(p.id),
        name: String(p.name || ""),
        sku: p.sku ?? null,
        unit: p.unit ?? null,
        price: p.price ?? null,
      })
    );

  if (args.inventoryEnabled) {
    return productMatches;
  }

  const productKeys = new Set(
    (args.products || []).map((p) => productItemKey(p)).filter(Boolean)
  );

  const manualMatches = (args.manualItems || [])
    .filter((m) => {
      const key = String(m.item_key || "").trim();
      const name = String(m.display_name || "").trim();
      if (!key || !name) return false;
      if (productKeys.has(key)) return false;
      return manualItemMatchesItemSearch(m, query);
    })
    .sort((a, b) => {
      const relA = itemSearchRelevance({
        haystack: buildManualItemSearchHaystack(a),
        query,
        primaryText: a.display_name,
      });
      const relB = itemSearchRelevance({
        haystack: buildManualItemSearchHaystack(b),
        query,
        primaryText: b.display_name,
      });
      if (relA !== relB) return relA - relB;
      return String(a.display_name || "").localeCompare(String(b.display_name || ""), "id");
    })
    .slice(0, limit)
    .map(
      (m): ManualItemSuggestion => ({
        kind: "manual",
        item_key: String(m.item_key),
        display_name: String(m.display_name),
        unit: String(m.unit || "").trim() || null,
      })
    );

  const merged: ItemSuggestion[] = [];
  const seen = new Set<string>();

  for (const item of productMatches) {
    const dedupeKey = `p:${item.id}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    merged.push(item);
    if (merged.length >= limit) return merged;
  }

  for (const item of manualMatches) {
    const dedupeKey = `m:${item.item_key}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    merged.push(item);
    if (merged.length >= limit) break;
  }

  return merged;
}
