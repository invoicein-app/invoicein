export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { buildReceivablesDashboard } from "@/lib/receivables-aggregate";
import { todayYmd } from "@/lib/receivable-utils";

export async function GET() {
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;

  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, invoice_date, due_date, customer_id, customer_name, status, amount_paid, discount_value, tax_value, invoice_items(qty, price)"
    )
    .eq("org_id", orgId)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const dashboard = buildReceivablesDashboard(data || [], todayYmd());

  return NextResponse.json({ ok: true, ...dashboard });
}
