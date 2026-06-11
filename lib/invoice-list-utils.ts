import type { SupabaseClient } from "@supabase/supabase-js";
import { calcInvoiceTotals } from "@/lib/invoice-totals";

export type InvoiceListFilters = {
  inv?: string;
  custId?: string;
  pay?: string;
  from?: string;
  to?: string;
};

export type UiPayStatus = "DRAFT" | "UNPAID" | "PARTIAL" | "PAID" | "CANCELLED";

export type InvoiceExportSourceRow = {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  customer_id: string | null;
  customer_name: string | null;
  status: string | null;
  amount_paid: number | null;
  discount_value: number | null;
  tax_value: number | null;
  bookkeeping_recorded: boolean | null;
  note: string | null;
  customers?: { name?: string | null } | null;
  invoice_items?: { qty?: number | null; price?: number | null }[] | null;
};

export type InvoiceListComputedRow = InvoiceExportSourceRow & {
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paid: number;
  remaining: number;
  payStatus: UiPayStatus;
};

export const INVOICE_EXPORT_SELECT = `
  id,
  invoice_number,
  invoice_date,
  due_date,
  customer_id,
  customer_name,
  status,
  amount_paid,
  discount_value,
  tax_value,
  bookkeeping_recorded,
  note,
  customers ( name ),
  invoice_items ( qty, price )
`;

const FETCH_BATCH = 500;

export function parseInvoiceListFilters(
  input: Record<string, string | undefined> | URLSearchParams
): InvoiceListFilters {
  const get = (key: string) => {
    if (input instanceof URLSearchParams) return input.get(key) || undefined;
    const v = input[key];
    return v ? String(v) : undefined;
  };

  const pay = get("pay")?.trim().toUpperCase();
  const validPay = ["DRAFT", "UNPAID", "PARTIAL", "PAID", "CANCELLED"];

  return {
    inv: get("inv")?.trim() || undefined,
    custId: get("custId")?.trim() || undefined,
    pay: pay && validPay.includes(pay) ? pay : undefined,
    from: get("from")?.trim() || undefined,
    to: get("to")?.trim() || undefined,
  };
}

export function getUiPayStatus(
  rawStatus: unknown,
  grandTotal: number,
  amountPaid: number
): UiPayStatus {
  const status = String(rawStatus || "").toLowerCase();

  if (status === "cancelled") return "CANCELLED";
  if (status === "draft") return "DRAFT";
  if (status === "paid") return "PAID";

  if (grandTotal <= 0) return "UNPAID";
  if (amountPaid >= grandTotal) return "PAID";
  if (amountPaid > 0) return "PARTIAL";
  return "UNPAID";
}

export function formatRawInvoiceStatus(status: unknown): string {
  const s = String(status || "").trim();
  if (!s) return "-";
  return s.toUpperCase();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyInvoiceListDbFilters<T extends { ilike?: any; eq?: any; gte?: any; lte?: any }>(
  query: T,
  filters: InvoiceListFilters
): T {
  let q = query;
  if (filters.inv) q = q.ilike("invoice_number", `%${filters.inv}%`);
  if (filters.custId) q = q.eq("customer_id", filters.custId);
  if (filters.from) q = q.gte("invoice_date", filters.from);
  if (filters.to) q = q.lte("invoice_date", filters.to);
  return q;
}

export function computeInvoiceListRow(inv: InvoiceExportSourceRow): InvoiceListComputedRow {
  const t = calcInvoiceTotals({
    discount_value: inv.discount_value,
    tax_value: inv.tax_value,
    amount_paid: inv.amount_paid,
    invoice_items: inv.invoice_items ?? undefined,
  });
  const payStatus = getUiPayStatus(inv.status, t.grandTotal, t.paid);
  return {
    ...inv,
    subtotal: t.subtotal,
    discount: t.discount,
    tax: t.tax,
    grandTotal: t.grandTotal,
    paid: t.paid,
    remaining: t.remaining,
    payStatus,
  };
}

export function filterByPayStatus(
  rows: InvoiceListComputedRow[],
  pay?: string
): InvoiceListComputedRow[] {
  if (!pay) return rows;
  return rows.filter((r) => r.payStatus === pay);
}

export async function fetchAllFilteredInvoices(
  supabase: SupabaseClient,
  filters: InvoiceListFilters
): Promise<InvoiceListComputedRow[]> {
  const all: InvoiceExportSourceRow[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from("invoices")
      .select(INVOICE_EXPORT_SELECT)
      .order("invoice_date", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + FETCH_BATCH - 1);

    query = applyInvoiceListDbFilters(query, filters);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const batch = (data || []) as InvoiceExportSourceRow[];
    all.push(...batch);

    if (batch.length < FETCH_BATCH) break;
    offset += FETCH_BATCH;
  }

  const computed = all.map(computeInvoiceListRow);
  return filterByPayStatus(computed, filters.pay);
}

export function buildInvoiceExportFilename(filters: InvoiceListFilters): string {
  const today = new Date().toISOString().slice(0, 10);

  if (filters.from && filters.to) {
    if (filters.from === filters.to) return `invoices-${filters.from}.xlsx`;
    return `invoices-${filters.from}_to_${filters.to}.xlsx`;
  }
  if (filters.from) return `invoices-from-${filters.from}.xlsx`;
  if (filters.to) return `invoices-to-${filters.to}.xlsx`;
  if (filters.pay) return `invoices-${filters.pay.toLowerCase()}-${today}.xlsx`;

  return `invoice-list-${today}.xlsx`;
}
