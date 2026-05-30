export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAuthAndOrg, getSupabaseFromCookies } from "@/lib/api-auth-org";
import { lookupCustomerLatestPrice, lookupCustomerLatestPriceMap } from "@/lib/customer-item-latest-price";

export async function GET(req: NextRequest) {
  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;

  const { orgId } = auth;
  const sp = req.nextUrl.searchParams;
  const customerId = String(sp.get("customer_id") || "").trim();

  if (!customerId) {
    return NextResponse.json({ error: "customer_id wajib diisi." }, { status: 400 });
  }

  const productId = String(sp.get("product_id") || "").trim();
  const productIdsRaw = String(sp.get("product_ids") || "").trim();
  const useHistoryFallback = sp.get("history") !== "0";

  if (productId) {
    const latest_price = await lookupCustomerLatestPrice({
      supabase,
      orgId,
      customerId,
      productId,
      useHistoryFallback,
    });

    return NextResponse.json({
      ok: true,
      customer_id: customerId,
      product_id: productId,
      latest_price,
    });
  }

  const productIds = productIdsRaw
    ? productIdsRaw.split(",").map((x) => x.trim()).filter(Boolean)
    : undefined;

  const prices = await lookupCustomerLatestPriceMap({
    supabase,
    orgId,
    customerId,
    productIds,
    useHistoryFallback,
  });

  return NextResponse.json({
    ok: true,
    customer_id: customerId,
    prices,
  });
}
