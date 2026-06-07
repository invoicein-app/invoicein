export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAuthAndOrg, getSupabaseFromCookies } from "@/lib/api-auth-org";
import { lookupCustomerLatestPrice, lookupCustomerLatestPriceMap, lookupCustomerLatestManualPriceMap } from "@/lib/customer-item-latest-price";

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
  const itemKey = String(sp.get("item_key") || "").trim();
  const itemKeysRaw = String(sp.get("item_keys") || "").trim();
  const useHistoryFallback = sp.get("history") !== "0";

  if (itemKey) {
    const latest_price = await lookupCustomerLatestPrice({
      supabase,
      orgId,
      customerId,
      itemKey,
      useHistoryFallback,
    });

    return NextResponse.json({
      ok: true,
      customer_id: customerId,
      item_key: itemKey,
      latest_price,
    });
  }

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

  const itemKeys = itemKeysRaw
    ? itemKeysRaw.split(",").map((x) => x.trim()).filter(Boolean)
    : undefined;

  const [prices, manual_prices] = await Promise.all([
    lookupCustomerLatestPriceMap({
      supabase,
      orgId,
      customerId,
      productIds,
      useHistoryFallback,
    }),
    itemKeys?.length
      ? lookupCustomerLatestManualPriceMap({
          supabase,
          orgId,
          customerId,
          itemKeys,
          useHistoryFallback,
        })
      : Promise.resolve({} as Record<string, number>),
  ]);

  return NextResponse.json({
    ok: true,
    customer_id: customerId,
    prices,
    manual_prices,
  });
}
