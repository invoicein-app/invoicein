// ✅ FULL REPLACE
// invoiceku/app/api/quotations/update/[id]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type Item = { product_id?: string | null; name: string; qty: number; price: number; sort_order?: number };

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function clampInt(n: number, min: number, max: number) {
  const x = Math.floor(num(n));
  if (x < min) return min;
  if (x > max) return max;
  return x;
}
function safeDateOrNull(v: any) {
  const s = String(v || "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function normalizeDiscountType(discount_type: any, discount_value: any): "percent" | "amount" {
  const raw = String(discount_type ?? "").trim().toLowerCase();
  if (raw === "amount" || raw === "fixed") return "amount";
  if (raw === "percent" || raw === "percentage") return "percent";
  const v = Math.floor(num(discount_value));
  return v > 100 ? "amount" : "percent";
}

function computeTotals(items: Array<{ qty: number; price: number }>, dt: "percent" | "amount", dVal: number, taxPct: number) {
  const subtotal = items.reduce((a, it) => a + it.qty * it.price, 0);

  let discountAmount = dt === "percent" ? Math.floor(subtotal * (dVal / 100)) : Math.floor(dVal);
  if (discountAmount > subtotal) discountAmount = subtotal;
  if (discountAmount < 0) discountAmount = 0;

  const afterDisc = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.floor(afterDisc * (taxPct / 100));
  const total = Math.max(0, afterDisc + taxAmount);

  return { subtotal, discountAmount, taxAmount, total };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

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
  if (userErr || !userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    discount_type,
    discount_value,
    tax_value,
    items,
  } = body as any;

  if (!String(customer_name || "").trim()) return NextResponse.json({ error: "Customer name wajib diisi." }, { status: 400 });
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: "Minimal 1 item." }, { status: 400 });
  if (items.some((it: any) => !String(it?.name || "").trim())) return NextResponse.json({ error: "Nama item tidak boleh kosong." }, { status: 400 });

  // check locked (RLS protected)
  const { data: qRow, error: qErr } = await supabase
    .from("quotations")
    .select("id,is_locked,invoice_id")
    .eq("id", id)
    .maybeSingle();

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 400 });
  if (!qRow) return NextResponse.json({ error: "Quotation tidak ditemukan / tidak punya akses." }, { status: 404 });
  if ((qRow as any).is_locked) return NextResponse.json({ error: "Quotation ini LOCKED, tidak bisa di-edit." }, { status: 400 });

  // normalize discount + tax
  const dt = normalizeDiscountType(discount_type, discount_value);
  let dVal = 0;
  if (dt === "percent") dVal = clampInt(discount_value ?? 0, 0, 100);
  else dVal = Math.max(0, Math.floor(num(discount_value ?? 0)));

  const tPct = clampInt(tax_value ?? 0, 0, 100);

  const normItems: Item[] = (items as any[]).map((it: any, idx: number) => ({
    product_id: it?.product_id ? String(it.product_id) : null,
    name: String(it?.name || ""),
    qty: Math.max(0, Math.floor(num(it?.qty))),
    price: Math.max(0, Math.floor(num(it?.price))),
    sort_order: Number.isFinite(Number(it?.sort_order)) ? Number(it.sort_order) : idx,
  }));

  const { subtotal, discountAmount, taxAmount, total } = computeTotals(
    normItems.map((x) => ({ qty: x.qty, price: x.price })),
    dt,
    dVal,
    tPct
  );

  // update header (pastikan kolom subtotal/total memang ada di quotations)
  const { error: upErr } = await supabase
    .from("quotations")
    .update({
      quotation_date: safeDateOrNull(quotation_date),
      customer_id: customer_id || null,
      customer_name: String(customer_name || ""),
      customer_phone: String(customer_phone || ""),
      customer_address: String(customer_address || ""),
      note: String(note || ""),

      discount_type: dt,
      discount_value: dVal,
      tax_value: tPct,

      subtotal,
      total,

      // optional: kalau ada kolom discount_amount/tax_amount di quotations, boleh buka 2 baris ini
      // discount_amount: discountAmount,
      // tax_amount: taxAmount,
    })
    .eq("id", id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  // replace items (delete then insert) — simple & stable
  const { error: delErr } = await supabase.from("quotation_items").delete().eq("quotation_id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  const insPayload = normItems.map((it) => ({
    quotation_id: id,
    product_id: it.product_id || null,
    name: it.name,
    qty: it.qty,
    price: it.price,
    sort_order: it.sort_order ?? 0,
  }));

  const { error: insErr } = await supabase.from("quotation_items").insert(insPayload);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

  return NextResponse.json(
    { ok: true, id, subtotal, discount_amount: discountAmount, tax_amount: taxAmount, total },
    { status: 200 }
  );
}
