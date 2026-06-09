export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import {
  buildCustomerItemPeriodSummary,
  parsePeriodMonthYear,
  yearOptions,
} from "@/lib/customer-item-summary";

export async function GET(req: NextRequest) {
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;
  const sp = req.nextUrl.searchParams;
  const { month, year } = parsePeriodMonthYear(sp.get("month"), sp.get("year"));
  const qCustomer = String(sp.get("q_customer") || sp.get("q") || "").trim();
  const qProduct = String(sp.get("q_product") || "").trim();

  try {
    const { period, rows } = await buildCustomerItemPeriodSummary({
      supabase,
      orgId,
      month,
      year,
      qCustomer,
      qProduct,
    });

    return NextResponse.json({
      ok: true,
      period: {
        month: period.month,
        year: period.year,
        start: period.start,
        end: period.end,
        label: period.label,
      },
      rows,
      year_options: yearOptions(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal memuat ringkasan." }, { status: 400 });
  }
}
