export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { asText, getAuthAndOrg, getSupabaseFromCookies } from "@/lib/api-auth-org";
import { normalizeCustomerName, toReceivableInvoice, todayYmd, isClosedInvoiceStatus } from "@/lib/receivable-utils";

type CustomerSummaryRow = {
  customer_id: string | null;
  customer_name: string;
  total_receivable: number;
  invoice_count: number;
  overdue_count: number;
  nearest_due_date: string | null;
  progress_percent: number;
};

export async function GET(req: NextRequest) {
  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;
  const { orgId } = auth;

  const { searchParams } = new URL(req.url);
  const q = asText(searchParams.get("q")).toLowerCase();
  const overdueFilter = asText(searchParams.get("overdue")).toLowerCase(); // all | overdue | non_overdue

  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, invoice_date, due_date, customer_id, customer_name, status, amount_paid, discount_value, tax_value, invoice_items(qty, price)"
    )
    .eq("org_id", orgId)
    .order("invoice_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const today = todayYmd();
  const map = new Map<string, CustomerSummaryRow & { total_paid: number; total_grand: number }>();

  for (const inv of data || []) {
    if (isClosedInvoiceStatus(inv.status)) continue;
    const x = toReceivableInvoice(inv, today);
    if (x.remaining_amount <= 0) continue;

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
      total_paid: 0,
      total_grand: 0,
    };

    prev.total_receivable += x.remaining_amount;
    prev.invoice_count += 1;
    prev.total_paid += x.paid_amount;
    prev.total_grand += x.grand_total;

    const isOverdue = Boolean(x.due_date && /^\d{4}-\d{2}-\d{2}$/.test(x.due_date) && x.due_date < today);
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
    progress_percent: r.total_grand > 0 ? Math.max(0, Math.min(100, Math.round((r.total_paid / r.total_grand) * 100))) : 0,
  }));

  if (overdueFilter === "overdue") rows = rows.filter((r) => r.overdue_count > 0);
  if (overdueFilter === "non_overdue") rows = rows.filter((r) => r.overdue_count === 0);

  rows.sort((a, b) => {
    if (b.total_receivable !== a.total_receivable) return b.total_receivable - a.total_receivable;
    return a.customer_name.localeCompare(b.customer_name, "id");
  });

  return NextResponse.json({ ok: true, rows, today });
}
