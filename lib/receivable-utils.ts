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
  const totals = calcInvoiceTotals(inv);
  const status = deriveReceivableStatus({
    remaining: totals.remaining,
    paid: totals.paid,
    dueDate: inv.due_date,
    today,
  });
  return {
    ...inv,
    grand_total: totals.grandTotal,
    paid_amount: totals.paid,
    remaining_amount: totals.remaining,
    receivable_status: status,
  };
}
