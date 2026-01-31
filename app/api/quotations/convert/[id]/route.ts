// ✅ FULL REPLACE FILE
// app/api/quotations/convert/[id]/route.ts
// Convert = "prepare invoice", BUKAN create invoice.
// Return data prefill (quotation + items) untuk /invoice/new?fromQuotation=...

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  // cookies() kadang ke-typing Promise
  const csAny: any = cookies() as any;
  const cookieStore: any = csAny?.then ? await csAny : csAny;

  // 1) user gate (RLS via cookies)
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }: any) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const { data: userRes, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) pastikan user boleh akses quotation ini (RLS)
  const { data: qGate, error: qGateErr } = await supabaseUser
    .from("quotations")
    .select("id, invoice_id, is_locked, status")
    .eq("id", id)
    .maybeSingle();

  if (qGateErr) return NextResponse.json({ error: qGateErr.message }, { status: 403 });
  if (!qGate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // kalau sudah pernah punya invoice_id, return invoice_id (idempotent)
  const existingInvoiceId = String((qGate as any).invoice_id || "");
  if (existingInvoiceId) {
    return NextResponse.json({ invoice_id: existingInvoiceId, reused: true }, { status: 200 });
  }

  // 3) admin (service role) untuk ambil detail lengkap + items
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: q, error: qErr } = await admin
    .from("quotations")
    .select(
      `
      id,
      organization_id,
      quotation_number,
      quotation_date,
      customer_id,
      customer_name,
      customer_phone,
      customer_address,
      note,
      discount_type,
      discount_value,
      tax_value,
      status,
      invoice_id,
      is_locked
    `
    )
    .eq("id", id)
    .single();

  if (qErr || !q) {
    return NextResponse.json({ error: qErr?.message || "Quotation not found" }, { status: 400 });
  }

  const { data: items, error: itErr } = await admin
    .from("quotation_items")
    .select("product_id, name, qty, price, sort_order")
    .eq("quotation_id", id)
    .order("sort_order", { ascending: true });

  if (itErr) return NextResponse.json({ error: itErr.message }, { status: 400 });

  // normalize discount_type: default percent
  const dtRaw = String((q as any).discount_type || "percent").toLowerCase();
  const discount_type: "percent" | "amount" =
    dtRaw === "amount" || dtRaw === "fixed" ? "amount" : "percent";

  // tax: percent only (Indonesia style)
  const tax_value = Math.max(0, Math.min(100, Math.floor(toNum((q as any).tax_value))));

  const prefill = {
    quotation_id: String((q as any).id),
    quotation_number: (q as any).quotation_number ?? null,
    quotation_date: (q as any).quotation_date ?? null,

    customer_id: (q as any).customer_id ?? null,
    customer_name: (q as any).customer_name ?? "",
    customer_phone: (q as any).customer_phone ?? "",
    customer_address: (q as any).customer_address ?? "",
    note: (q as any).note ?? "",

    discount_type,
    discount_value: toNum((q as any).discount_value),

    tax_value,

    items: (items || []).map((it: any, idx: number) => ({
      product_id: it.product_id ?? null,
      name: String(it.name || "").trim(),
      qty: Math.max(0, Math.floor(toNum(it.qty))),
      price: Math.max(0, Math.floor(toNum(it.price))),
      sort_order: Number.isFinite(Number(it.sort_order)) ? Number(it.sort_order) : idx,
    })),
  };

  return NextResponse.json({ prefill: true, prefill_data: prefill }, { status: 200 });
}
