import { calcInvoiceTotals } from "@/lib/invoice-totals";

export type ReceivableInvoiceRow = {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  customer_id: string | null;
  customer_name: string | null;
  status: string | null;
  amount_paid?: unknown;
  discount_value?: unknown;
  tax_value?: unknown;
  invoice_items?: { qty?: unknown; price?: unknown }[];
};

export type ReceivableStatus =
  | "BELUM_DIBAYAR"
  | "SEBAGIAN"
  | "LUNAS"
  | "LEWAT_JATUH_TEMPO";

/** Umur piutang berdasarkan hari lewat jatuh tempo (due_date). */
export type ReceivableAgingBucket = "current" | "days_0_30" | "days_31_60" | "days_60_plus";

export type ReceivableAgingAmounts = {
  current: number;
  days_0_30: number;
  days_31_60: number;
  days_60_plus: number;
};

export function emptyAgingAmounts(): ReceivableAgingAmounts {
  return { current: 0, days_0_30: 0, days_31_60: 0, days_60_plus: 0 };
}

export function agingBucketLabel(bucket: ReceivableAgingBucket): string {
  if (bucket === "current") return "Belum jatuh tempo";
  if (bucket === "days_0_30") return "0–30 hari";
  if (bucket === "days_31_60") return "31–60 hari";
  return "60+ hari";
}

export function parseAgingFilter(v: unknown): ReceivableAgingBucket | "" {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "current") return "current";
  if (s === "0_30" || s === "days_0_30") return "days_0_30";
  if (s === "31_60" || s === "days_31_60") return "days_31_60";
  if (s === "60_plus" || s === "days_60_plus") return "days_60_plus";
  return "";
}

export function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T12:00:00`);
  const b = new Date(`${toYmd}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

/** Hari lewat jatuh tempo; 0 jika belum jatuh tempo atau tanpa due_date valid. */
export function daysPastDue(dueDate: string | null | undefined, today?: string): number {
  const t = today || todayYmd();
  const d = String(dueDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d >= t) return 0;
  return daysBetweenYmd(d, t);
}

export function deriveAgingBucket(
  dueDate: string | null | undefined,
  today?: string
): ReceivableAgingBucket {
  const t = today || todayYmd();
  const d = String(dueDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d >= t) return "current";
  const days = daysPastDue(d, t);
  if (days <= 30) return "days_0_30";
  if (days <= 60) return "days_31_60";
  return "days_60_plus";
}

export function addToAgingAmounts(
  amounts: ReceivableAgingAmounts,
  bucket: ReceivableAgingBucket,
  amount: number
) {
  if (amount <= 0) return;
  amounts[bucket] += amount;
}

export function agingAmountForBucket(
  amounts: ReceivableAgingAmounts,
  bucket: ReceivableAgingBucket
): number {
  return amounts[bucket];
}

export function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function normalizeCustomerName(v: unknown) {
  return String(v ?? "").trim();
}

export function isClosedInvoiceStatus(v: unknown) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "cancelled" || s === "draft";
}

export function deriveReceivableStatus(args: {
  remaining: number;
  paid: number;
  dueDate?: string | null;
  today?: string;
}): ReceivableStatus {
  const today = args.today || todayYmd();
  if (args.remaining <= 0) return "LUNAS";
  if (args.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(args.dueDate) && args.dueDate < today) {
    return "LEWAT_JATUH_TEMPO";
  }
  if (args.paid > 0) return "SEBAGIAN";
  return "BELUM_DIBAYAR";
}

export function receivableStatusLabel(v: ReceivableStatus) {
  if (v === "LUNAS") return "Lunas";
  if (v === "SEBAGIAN") return "Sebagian";
  if (v === "LEWAT_JATUH_TEMPO") return "Lewat Jatuh Tempo";
  return "Belum Dibayar";
}

export function toReceivableInvoice(inv: ReceivableInvoiceRow, today?: string) {
  const t = today || todayYmd();
  const totals = calcInvoiceTotals(inv);
  const status = deriveReceivableStatus({
    remaining: totals.remaining,
    paid: totals.paid,
    dueDate: inv.due_date,
    today: t,
  });
  const aging_bucket = deriveAgingBucket(inv.due_date, t);
  const days_past_due = daysPastDue(inv.due_date, t);
  return {
    ...inv,
    grand_total: totals.grandTotal,
    paid_amount: totals.paid,
    remaining_amount: totals.remaining,
    receivable_status: status,
    aging_bucket,
    aging_bucket_label: agingBucketLabel(aging_bucket),
    days_past_due,
  };
}
