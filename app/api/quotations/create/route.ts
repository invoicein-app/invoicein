export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireCanWrite } from "@/lib/subscription";
import {
  allocateDocumentNumber,
  coerceDateOrToday,
  releaseDocumentNumberAllocation,
} from "@/lib/document-numbering";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { createQuotationBodySchema } from "@/lib/validations/quotation";

function clampInt(n: number, min: number, max: number) {
  const x = Math.floor(n);
  if (x < min) return min;
  if (x > max) return max;
  return x;
}

export async function POST(req: Request) {
  const csAny: any = cookies() as any;
  const cookieStore: any = csAny?.then ? await csAny : csAny;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }: any) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("org_id,is_active")
    .eq("user_id", userRes.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });

  const orgId = String((membership as { org_id?: string } | null)?.org_id || "");
  if (!orgId) return NextResponse.json({ error: "Kamu belum punya organisasi aktif." }, { status: 400 });

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const parsedBody = await parseJsonBody(req, createQuotationBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const {
    quotation_date,
    customer_id,
    customer_name,
    customer_phone,
    customer_address,
    note,
    discount_type,
    discount_value,
    tax_value: taxPct,
    items,
  } = body;

  const dType = discount_type ?? "percent";

  const safeItems = items.map((it) => ({
    product_id: it.product_id,
    name: it.name,
    qty: it.qty,
    price: it.price,
  }));

  const subtotal = safeItems.reduce((a, it) => a + it.qty * it.price, 0);

  let discountAmount = 0;
  let storedDiscountValue = 0;

  if (dType === "amount") {
    const amt = Math.max(0, Math.floor(discount_value));
    discountAmount = Math.min(subtotal, amt);
    storedDiscountValue = amt;
  } else {
    const pct = clampInt(discount_value, 0, 100);
    discountAmount = Math.floor(subtotal * (pct / 100));
    storedDiscountValue = pct;
  }

  const afterDisc = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.floor(afterDisc * (taxPct / 100));
  const total = Math.max(0, afterDisc + taxAmount);

  const normalizedQuotationDate = coerceDateOrToday(quotation_date || undefined);
  const docAllocation = await allocateDocumentNumber({
    orgId,
    docType: "quotation",
    documentDate: normalizedQuotationDate,
  });
  const quotation_number = docAllocation.documentNumber;

  const { data: quo, error: quoErr } = await supabase
    .from("quotations")
    .insert({
      organization_id: orgId,
      quotation_number,
      quotation_date: normalizedQuotationDate,
      customer_id,
      customer_name,
      customer_phone,
      customer_address,
      note,
      discount_type: dType,
      discount_value: storedDiscountValue,
      tax_value: taxPct,
      subtotal,
      total,
      status: "draft",
      invoice_id: null,
      is_locked: false,
    })
    .select("id, quotation_number")
    .single();

  if (quoErr) {
    await releaseDocumentNumberAllocation(docAllocation);
    return NextResponse.json({ error: quoErr.message }, { status: 400 });
  }

  const payloadItems = safeItems.map((it, idx) => ({
    quotation_id: quo.id,
    product_id: it.product_id,
    name: it.name,
    qty: it.qty,
    price: it.price,
    sort_order: idx,
  }));

  const { error: itemErr } = await supabase.from("quotation_items").insert(payloadItems);

  if (itemErr) {
    await supabase.from("quotations").delete().eq("id", quo.id);
    await releaseDocumentNumberAllocation(docAllocation);
    return NextResponse.json({ error: itemErr.message }, { status: 400 });
  }

  return NextResponse.json(
    { id: quo.id, quotation_number: quo.quotation_number ?? quotation_number },
    { status: 200 }
  );
}
