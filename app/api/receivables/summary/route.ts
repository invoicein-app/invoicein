export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { asText, requireApiContext } from "@/lib/api-context";
import {
  addToAgingAmounts,
  agingAmountForBucket,
  emptyAgingAmounts,
  normalizeCustomerName,
  parseAgingFilter,
  toReceivableInvoice,
  todayYmd,
  isClosedInvoiceStatus,
  type ReceivableAgingAmounts,
  type ReceivableAgingBucket,
} from "@/lib/receivable-utils";

type CustomerSummaryRow = {
  customer_id: string | null;
  customer_name: string;
  total_receivable: number;
  invoice_count: number;
  overdue_count: number;
  nearest_due_date: string | null;
  progress_percent: number;
  aging: ReceivableAgingAmounts;
};

export async function GET(req: NextRequest) {
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const q = asText(searchParams.get("q")).toLowerCase();
  const overdueFilter = asText(searchParams.get("overdue")).toLowerCase(); // all | overdue | non_overdue
  const agingFilter = parseAgingFilter(searchParams.get("aging"));

  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, invoice_date, due_date, customer_id, customer_name, status, amount_paid, discount_value, tax_value, invoice_items(qty, price)"
    )
    .eq("org_id", orgId)
    .order("invoice_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const today = todayYmd();
  const agingTotals = emptyAgingAmounts();
  const map = new Map<
    string,
    CustomerSummaryRow & { total_paid: number; total_grand: number }
  >();

  for (const inv of data || []) {
    if (isClosedInvoiceStatus(inv.status)) continue;
    const x = toReceivableInvoice(inv, today);
    if (x.remaining_amount <= 0) continue;

    addToAgingAmounts(agingTotals, x.aging_bucket, x.remaining_amount);

    const customerName = normalizeCustomerName(x.customer_name) || "Customer tanpa nama";
    if (q && !customerName.toLowerCase().includes(q)) continue;

    const key = x.customer_id ? `id:${x.customer_id}` : `name:${customerName.toLowerCase()}`;
    const prev = map.get(key) || {
      customer_id: x.customer_id || null,
      customer_name: customerName,
      total_receivable: 0,
      invoice_count: 0,
      overdue_count: 0,
      nearest_due_date: null,
      progress_percent: 0,
      aging: emptyAgingAmounts(),
      total_paid: 0,
      total_grand: 0,
    };

    prev.total_receivable += x.remaining_amount;
    prev.invoice_count += 1;
    prev.total_paid += x.paid_amount;
    prev.total_grand += x.grand_total;
    addToAgingAmounts(prev.aging, x.aging_bucket, x.remaining_amount);

    const isOverdue = x.days_past_due > 0;
    if (isOverdue) prev.overdue_count += 1;
    if (x.due_date && /^\d{4}-\d{2}-\d{2}$/.test(x.due_date)) {
      if (!prev.nearest_due_date || x.due_date < prev.nearest_due_date) {
        prev.nearest_due_date = x.due_date;
      }
    }

    map.set(key, prev);
  }

  let rows = Array.from(map.values()).map((r) => ({
    customer_id: r.customer_id,
    customer_name: r.customer_name,
    total_receivable: r.total_receivable,
    invoice_count: r.invoice_count,
    overdue_count: r.overdue_count,
    nearest_due_date: r.nearest_due_date,
    progress_percent:
      r.total_grand > 0
        ? Math.max(0, Math.min(100, Math.round((r.total_paid / r.total_grand) * 100)))
        : 0,
    aging: r.aging,
  }));

  if (overdueFilter === "overdue") rows = rows.filter((r) => r.overdue_count > 0);
  if (overdueFilter === "non_overdue") rows = rows.filter((r) => r.overdue_count === 0);

  if (agingFilter) {
    rows = rows.filter(
      (r) => agingAmountForBucket(r.aging, agingFilter as ReceivableAgingBucket) > 0
    );
  }

  rows.sort((a, b) => {
    if (b.total_receivable !== a.total_receivable) return b.total_receivable - a.total_receivable;
    return a.customer_name.localeCompare(b.customer_name, "id");
  });

  return NextResponse.json({ ok: true, rows, today, aging_totals: agingTotals });
}
