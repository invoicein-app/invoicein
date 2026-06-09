import {
  addToAgingAmounts,
  emptyAgingAmounts,
  isClosedInvoiceStatus,
  normalizeCustomerName,
  toReceivableInvoice,
  todayYmd,
  type ReceivableAgingAmounts,
  type ReceivableInvoiceRow,
} from "@/lib/receivable-utils";

export type ReceivablesDashboardCustomer = {
  customer_id: string | null;
  customer_name: string;
  total_receivable: number;
  invoice_count: number;
  overdue_count: number;
  aging: ReceivableAgingAmounts;
};

export type ReceivablesDashboardInvoice = {
  id: string;
  invoice_number: string | null;
  customer_id: string | null;
  customer_name: string;
  due_date: string | null;
  remaining_amount: number;
  receivable_status: string;
  aging_bucket: string;
  aging_bucket_label: string;
  days_past_due: number;
};

export type ReceivablesDashboardData = {
  today: string;
  totals: {
    total_receivable: number;
    customer_count: number;
    invoice_count: number;
    overdue_count: number;
    status_belum_dibayar: number;
    status_sebagian: number;
  };
  aging_totals: ReceivableAgingAmounts;
  top_customers: ReceivablesDashboardCustomer[];
  urgent_invoices: ReceivablesDashboardInvoice[];
};

export function buildReceivablesDashboard(
  rawInvoices: ReceivableInvoiceRow[],
  today = todayYmd()
): ReceivablesDashboardData {
  const aging_totals = emptyAgingAmounts();
  const customerMap = new Map<string, ReceivablesDashboardCustomer>();
  const urgent: ReceivablesDashboardInvoice[] = [];

  let invoice_count = 0;
  let overdue_count = 0;
  let status_belum_dibayar = 0;
  let status_sebagian = 0;

  for (const inv of rawInvoices) {
    if (isClosedInvoiceStatus(inv.status)) continue;
    const x = toReceivableInvoice(inv, today);
    if (x.remaining_amount <= 0) continue;

    invoice_count += 1;
    addToAgingAmounts(aging_totals, x.aging_bucket, x.remaining_amount);

    if (x.receivable_status === "LEWAT_JATUH_TEMPO") overdue_count += 1;
    if (x.receivable_status === "BELUM_DIBAYAR") status_belum_dibayar += 1;
    if (x.receivable_status === "SEBAGIAN") status_sebagian += 1;

    const customerName = normalizeCustomerName(x.customer_name) || "Customer tanpa nama";
    const key = x.customer_id ? `id:${x.customer_id}` : `name:${customerName.toLowerCase()}`;
    const prev = customerMap.get(key) || {
      customer_id: x.customer_id || null,
      customer_name: customerName,
      total_receivable: 0,
      invoice_count: 0,
      overdue_count: 0,
      aging: emptyAgingAmounts(),
    };
    prev.total_receivable += x.remaining_amount;
    prev.invoice_count += 1;
    if (x.days_past_due > 0) prev.overdue_count += 1;
    addToAgingAmounts(prev.aging, x.aging_bucket, x.remaining_amount);
    customerMap.set(key, prev);

    if (x.days_past_due > 0) {
      urgent.push({
        id: x.id,
        invoice_number: x.invoice_number,
        customer_id: x.customer_id,
        customer_name: customerName,
        due_date: x.due_date,
        remaining_amount: x.remaining_amount,
        receivable_status: x.receivable_status,
        aging_bucket: x.aging_bucket,
        aging_bucket_label: x.aging_bucket_label,
        days_past_due: x.days_past_due,
      });
    }
  }

  const top_customers = Array.from(customerMap.values())
    .sort((a, b) => b.total_receivable - a.total_receivable)
    .slice(0, 8);

  urgent.sort((a, b) => {
    if (b.days_past_due !== a.days_past_due) return b.days_past_due - a.days_past_due;
    return b.remaining_amount - a.remaining_amount;
  });

  const total_receivable =
    aging_totals.current +
    aging_totals.days_0_30 +
    aging_totals.days_31_60 +
    aging_totals.days_60_plus;

  return {
    today,
    totals: {
      total_receivable,
      customer_count: customerMap.size,
      invoice_count,
      overdue_count,
      status_belum_dibayar,
      status_sebagian,
    },
    aging_totals,
    top_customers,
    urgent_invoices: urgent.slice(0, 12),
  };
}
