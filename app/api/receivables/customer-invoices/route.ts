export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { asText, getAuthAndOrg, getSupabaseFromCookies } from "@/lib/api-auth-org";
import {
  normalizeCustomerName,
  receivableStatusLabel,
  toReceivableInvoice,
  todayYmd,
  isClosedInvoiceStatus,
} from "@/lib/receivable-utils";

export async function GET(req: NextRequest) {
  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;
  const { orgId } = auth;

  const { searchParams } = new URL(req.url);
  const customerId = asText(searchParams.get("customer_id"));
  const customerName = asText(searchParams.get("customer_name"));
  const q = asText(searchParams.get("q")).toLowerCase();
  const statusFilter = asText(searchParams.get("status")).toLowerCase(); // all|belum_dibayar|sebagian|lunas|lewat_jatuh_tempo
  const overdueOnly = asText(searchParams.get("overdue")) === "1";
  const dueMonth = asText(searchParams.get("due_month")); // YYYY-MM

  if (!customerId && !customerName) {
    return NextResponse.json({ error: "customer_id atau customer_name wajib diisi." }, { status: 400 });
  }

  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, invoice_date, due_date, customer_id, customer_name, status, amount_paid, discount_value, tax_value, invoice_items(qty, price)"
    )
    .eq("org_id", orgId)
    .order("invoice_date", { ascending: false });

  if (customerId) query = query.eq("customer_id", customerId);
  else query = query.eq("customer_name", customerName);

  if (q) query = query.ilike("invoice_number", `%${q}%`);
  if (dueMonth && /^\d{4}-\d{2}$/.test(dueMonth)) {
    const [y, m] = dueMonth.split("-").map(Number);
    const start = `${dueMonth}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${dueMonth}-${String(lastDay).padStart(2, "0")}`;
    query = query.gte("due_date", start).lte("due_date", end);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const today = todayYmd();
  let rows = (data || [])
    .filter((inv) => !isClosedInvoiceStatus(inv.status))
    .map((inv) => toReceivableInvoice(inv, today));

  // Default detail: fokus piutang aktif saja.
  if (!statusFilter || statusFilter === "all") {
    rows = rows.filter((r) => r.remaining_amount > 0);
  }

  if (statusFilter === "belum_dibayar") rows = rows.filter((r) => r.receivable_status === "BELUM_DIBAYAR");
  if (statusFilter === "sebagian") rows = rows.filter((r) => r.receivable_status === "SEBAGIAN");
  if (statusFilter === "lunas") rows = rows.filter((r) => r.receivable_status === "LUNAS");
  if (statusFilter === "lewat_jatuh_tempo") rows = rows.filter((r) => r.receivable_status === "LEWAT_JATUH_TEMPO");

  if (overdueOnly) {
    rows = rows.filter((r) => r.receivable_status === "LEWAT_JATUH_TEMPO");
  }

  const openRows = rows.filter((r) => r.remaining_amount > 0);
  const summary = {
    customer_id: customerId || null,
    customer_name: customerName || normalizeCustomerName(rows[0]?.customer_name) || "-",
    total_receivable: openRows.reduce((a, r) => a + r.remaining_amount, 0),
    invoice_count: openRows.length,
    overdue_count: openRows.filter((r) => r.receivable_status === "LEWAT_JATUH_TEMPO").length,
    nearest_due_date: openRows
      .map((r) => r.due_date)
      .filter((d): d is string => Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d)))
      .sort()[0] || null,
  };

  return NextResponse.json({
    ok: true,
    today,
    summary,
    invoices: rows.map((r) => ({
      id: r.id,
      invoice_number: r.invoice_number,
      invoice_date: r.invoice_date,
      due_date: r.due_date,
      grand_total: r.grand_total,
      paid_amount: r.paid_amount,
      remaining_amount: r.remaining_amount,
      receivable_status: r.receivable_status,
      receivable_status_label: receivableStatusLabel(r.receivable_status),
    })),
  });
}
