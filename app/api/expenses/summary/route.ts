export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { paidSalesTotalForMonth, monthKeyFromDate, monthStart } from "@/lib/invoice-totals";
import { asText, requireApiContext } from "@/lib/api-context";

export async function GET(req: NextRequest) {
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;

  const month =
    asText(new URL(req.url).searchParams.get("month")) || monthKeyFromDate(monthStart(new Date()));

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Format bulan harus YYYY-MM." }, { status: 400 });
  }

  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, "0")}`;

  const [{ data: expenses, error: expErr }, { data: invoices, error: invErr }] = await Promise.all([
    supabase
      .from("expenses")
      .select("amount, payment_status, category")
      .eq("org_id", orgId)
      .gte("expense_date", start)
      .lte("expense_date", end),
    supabase
      .from("invoices")
      .select("invoice_date, discount_value, tax_value, amount_paid, invoice_items(qty, price)")
      .eq("org_id", orgId),
  ]);

  if (expErr) return NextResponse.json({ error: expErr.message }, { status: 400 });
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 400 });

  let totalExpenses = 0;
  let paidExpenses = 0;
  let unpaidExpenses = 0;
  const byCategory: Record<string, number> = {};

  for (const e of expenses || []) {
    const amt = Number(e.amount) || 0;
    totalExpenses += amt;
    if (e.payment_status === "paid") paidExpenses += amt;
    else unpaidExpenses += amt;
    const cat = String(e.category || "lain-lain");
    byCategory[cat] = (byCategory[cat] || 0) + amt;
  }

  const monthlySalesTotal = paidSalesTotalForMonth(invoices || [], month);
  const profitEstimate = monthlySalesTotal - paidExpenses;

  return NextResponse.json({
    ok: true,
    month,
    monthlySalesTotal,
    salesSource: "paid_invoices_grand_total_by_invoice_date",
    totalExpenses,
    paidExpenses,
    unpaidExpenses,
    profitEstimate,
    byCategory: Object.entries(byCategory)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total),
  });
}
