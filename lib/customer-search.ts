import { matchesItemSearch, normalizeItemSearchText } from "@/lib/item-search";

export type CustomerSearchSource = {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
};

export function buildCustomerSearchHaystack(customer: CustomerSearchSource): string {
  return normalizeItemSearchText(customer.name || "");
}

export function customerMatchesSearch(customer: CustomerSearchSource, query: string): boolean {
  return matchesItemSearch(buildCustomerSearchHaystack(customer), query);
}

export function filterCustomersForSearch<T extends CustomerSearchSource>(
  customers: T[],
  query: string,
  limit = 20
): T[] {
  const q = normalizeItemSearchText(query);
  if (!q) return customers.slice(0, limit);
  return customers.filter((c) => customerMatchesSearch(c, query)).slice(0, limit);
}

export function formatCustomerPickerLabel(customer: CustomerSearchSource): string {
  return String(customer.name || "").trim();
}
