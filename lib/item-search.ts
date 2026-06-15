export type ProductSearchSource = {
  name?: string | null;
  sku?: string | null;
  unit?: string | null;
};

export type ManualItemSearchSource = {
  display_name?: string | null;
  item_key?: string | null;
};

/** Lowercase, trim, and collapse repeated whitespace for stable comparisons. */
export function normalizeItemSearchText(text: unknown): string {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Turn slug-like item keys into searchable words (e.g. `b-panjang` → `b panjang`). */
export function itemKeyToSearchText(itemKey: unknown): string {
  return normalizeItemSearchText(String(itemKey ?? "").replace(/-/g, " "));
}

export function buildProductSearchHaystack(product: ProductSearchSource): string {
  return normalizeItemSearchText(
    `${product.name || ""} ${product.sku || ""} ${product.unit || ""}`
  );
}

export function buildManualItemSearchHaystack(manual: ManualItemSearchSource): string {
  return normalizeItemSearchText(
    `${manual.display_name || ""} ${itemKeyToSearchText(manual.item_key || "")}`
  );
}

/**
 * Case-insensitive contains search with light normalization.
 * Multi-word queries also match when every token appears anywhere in the haystack.
 */
export function matchesItemSearch(haystack: string, query: string): boolean {
  const q = normalizeItemSearchText(query);
  if (!q) return true;

  const hay = normalizeItemSearchText(haystack);
  if (hay.includes(q)) return true;

  const tokens = q.split(" ").filter(Boolean);
  if (tokens.length > 1) {
    return tokens.every((token) => hay.includes(token));
  }

  return false;
}

export function productMatchesItemSearch(product: ProductSearchSource, query: string): boolean {
  return matchesItemSearch(buildProductSearchHaystack(product), query);
}

export function manualItemMatchesItemSearch(manual: ManualItemSearchSource, query: string): boolean {
  return matchesItemSearch(buildManualItemSearchHaystack(manual), query);
}

/**
 * Lower score = better match. Used to surface relevant items before the result limit.
 */
export function itemSearchRelevance(args: {
  haystack: string;
  query: string;
  primaryText?: string;
}): number {
  const q = normalizeItemSearchText(args.query);
  if (!q) return 0;

  const hay = normalizeItemSearchText(args.haystack);
  const primary = normalizeItemSearchText(args.primaryText ?? args.haystack);

  if (primary.startsWith(q)) return 0;
  if (primary.includes(q)) return 1;
  if (hay.includes(q)) return 2;

  const tokens = q.split(" ").filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => hay.includes(token))) return 3;

  return 999;
}
