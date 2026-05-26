/** Shared invoice total math (aligned with dashboard omset). */

function clampPercent(v: unknown) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export type InvoicePayState = "UNPAID" | "PARTIAL" | "PAID";

export function calcInvoiceTotals(inv: {
  discount_value?: unknown;
  tax_value?: unknown;
  amount_paid?: unknown;
  invoice_items?: { qty?: unknown; price?: unknown }[];
}) {
  const items = inv?.invoice_items || [];
  const subtotal = items.reduce(
    (a, it) => a + Number(it?.qty || 0) * Number(it?.price || 0),
    0
  );

  const discPct = clampPercent(inv?.discount_value);
  const taxPct = clampPercent(inv?.tax_value);

  const discount = Math.max(0, subtotal * (discPct / 100));
  const afterDisc = Math.max(0, subtotal - discount);
  const tax = Math.max(0, afterDisc * (taxPct / 100));
  const grandTotal = Math.max(0, afterDisc + tax);

  const paid = Math.max(0, Number(inv?.amount_paid || 0));
  const remaining = Math.max(0, grandTotal - paid);

  let payState: InvoicePayState = "UNPAID";
  if (grandTotal > 0 && remaining <= 0) payState = "PAID";
  else if (paid > 0 && remaining > 0) payState = "PARTIAL";

  return { subtotal, discount, tax, grandTotal, paid, remaining, payState };
}

export function monthKeyFromDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(1);
  return x;
}

/** Omset: grandTotal invoice PAID by invoice_date month (same as dashboard Paid Bulan Ini). */
export function paidSalesTotalForMonth(
  invoices: {
    invoice_date?: string | null;
    discount_value?: unknown;
    tax_value?: unknown;
    amount_paid?: unknown;
    invoice_items?: { qty?: unknown; price?: unknown }[];
  }[],
  monthKey: string
) {
  let total = 0;
  for (const inv of invoices) {
    const t = calcInvoiceTotals(inv);
    if (t.payState !== "PAID") continue;
    const dt = inv.invoice_date ? new Date(inv.invoice_date) : null;
    if (!dt || Number.isNaN(dt.getTime())) continue;
    const mk = monthKeyFromDate(monthStart(dt));
    if (mk === monthKey) total += t.grandTotal;
  }
  return total;
}
