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

type ItemIn = { product_id?: string | null; name: string; qty: number; price: number };

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clampInt(n: any, min: number, max: number) {
  const x = Math.floor(num(n));
  if (x < min) return min;
  if (x > max) return max;
  return x;
}

export async function POST(req: Request) {
  // cookies() kadang ke-typing Promise di beberapa versi Next — handle dua-duanya
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

  // auth
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = userRes.user;

  // membership -> org
  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("org_id,is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });

  const orgId = String((membership as any)?.org_id || "");
  if (!orgId) return NextResponse.json({ error: "Kamu belum punya organisasi aktif." }, { status: 400 });

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  // body
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const {
    quotation_date,
    customer_id,
    customer_name,
    customer_phone,
    customer_address,
    note,

    // discount: percent / amount
    discount_type, // "percent" | "amount"
    discount_value,

    // tax: percent only (Indonesia)
    tax_value,

    items,
  } = body as {
    quotation_date: string;
    customer_id?: string | null;
    customer_name: string;
    customer_phone?: string;
    customer_address?: string;
    note?: string;

    discount_type?: string | null;
    discount_value?: number | null;

    tax_value?: number | null;

    items: ItemIn[];
  };

  // validate basic
  if (!String(customer_name || "").trim()) {
    return NextResponse.json({ error: "Customer name wajib diisi." }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Minimal 1 item." }, { status: 400 });
  }
  if (items.some((it) => !String(it?.name || "").trim())) {
    return NextResponse.json({ error: "Nama item tidak boleh kosong." }, { status: 400 });
  }

  // normalize numbers
  const safeItems = items.map((it) => ({
    product_id: it.product_id ? String(it.product_id) : null,
    name: String(it.name || ""),
    qty: Math.max(0, Math.floor(num(it.qty))),
    price: Math.max(0, Math.floor(num(it.price))),
  }));

  // hitung subtotal
  const subtotal = safeItems.reduce((a, it) => a + it.qty * it.price, 0);

  // discount handling
  const dType = String(discount_type || "percent").toLowerCase() === "amount" ? "amount" : "percent";

  let discountAmount = 0;
  let storedDiscountValue = 0;

  if (dType === "amount") {
    const amt = Math.max(0, Math.floor(num(discount_value)));
    discountAmount = Math.min(subtotal, amt);
    storedDiscountValue = amt; // simpan nominal yg user isi
  } else {
    const pct = clampInt(discount_value ?? 0, 0, 100);
    discountAmount = Math.floor(subtotal * (pct / 100));
    storedDiscountValue = pct; // simpan % yg user isi
  }

  const afterDisc = Math.max(0, subtotal - discountAmount);

  // tax percent only
  const taxPct = clampInt(tax_value ?? 0, 0, 100);
  const taxAmount = Math.floor(afterDisc * (taxPct / 100));

  const total = Math.max(0, afterDisc + taxAmount);

  // quotation_number wajib (not null)
  const normalizedQuotationDate = coerceDateOrToday(quotation_date);
  const docAllocation = await allocateDocumentNumber({
    orgId,
    docType: "quotation",
    documentDate: normalizedQuotationDate,
  });
  const quotation_number = docAllocation.documentNumber;

  // insert header
  const { data: quo, error: quoErr } = await supabase
    .from("quotations")
    .insert({
      organization_id: orgId,

      quotation_number,
      quotation_date: normalizedQuotationDate,

      customer_id: customer_id || null,
      customer_name: customer_name,
      customer_phone: customer_phone || "",
      customer_address: customer_address || "",
      note: note || "",

      // simpan config diskon & pajak
      discount_type: dType, // "percent" | "amount"
      discount_value: storedDiscountValue,
      tax_value: taxPct,

      // simpan hasil hitung biar list/detail gak Rp 0
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

  // insert items
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