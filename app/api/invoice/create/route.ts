// ✅ FULL REPLACE
// invoiceku/app/api/invoice/create/route.ts
//
// - Support discount_type (percent|amount) + tax percent-only
// - Compute subtotal/discount_amount/tax_amount/total
// - If quotation_id present:
//    ✅ fetch quotation_number and store into invoices.quotation_number
//    ✅ link back: quotations.invoice_id + lock + accepted (best-effort)
//
// REQUIREMENTS (kolom harus ada di invoices):
// - subtotal (number)
// - discount_amount (number)
// - tax_amount (number)
// - total (number)
// - quotation_id (uuid/text)  (optional tapi kamu sudah pakai)
// - quotation_number (text)  ✅ NEW (ini yang kamu minta)

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { logActivity } from "@/lib/log-activity";

type Item = { name: string; qty: number; price: number };

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

  // ✅ kalau FE ngirim type, PERCAYA type itu
  if (raw === "amount" || raw === "fixed") return "amount";
  if (raw === "percent" || raw === "percentage") return "percent";

  // ✅ infer cuma kalau kosong / unknown
  const v = Math.floor(num(discount_value));
  return v > 100 ? "amount" : "percent";
}

function computeTotals(items: Item[], dt: "percent" | "amount", dVal: number, taxPct: number) {
  const subtotal = items.reduce((a, it) => a + it.qty * it.price, 0);

  let discountAmount = dt === "percent" ? Math.floor(subtotal * (dVal / 100)) : Math.floor(dVal);

  if (discountAmount > subtotal) discountAmount = subtotal;
  if (discountAmount < 0) discountAmount = 0;

  const afterDisc = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.floor(afterDisc * (taxPct / 100));
  const total = Math.max(0, afterDisc + taxAmount);

  return { subtotal, discountAmount, taxAmount, total };
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
            cookiesToSet.forEach(({ name, value, options }: any) =>
              cookieStore.set(name, value, options)
            );
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

  // body
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const {
    invoice_date,
    due_date,
    quotation_id,

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

  // validate
  if (!String(customer_name || "").trim()) {
    return NextResponse.json({ error: "Customer name wajib diisi." }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Minimal 1 item." }, { status: 400 });
  }
  if (items.some((it: any) => !String(it?.name || "").trim())) {
    return NextResponse.json({ error: "Nama item tidak boleh kosong." }, { status: 400 });
  }

  // membership (org + role)
  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("org_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });
  if (!membership?.org_id) {
    return NextResponse.json({ error: "Kamu belum punya organisasi aktif." }, { status: 400 });
  }

  const orgId = String(membership.org_id);
  const actorRole = String((membership as any).role || "staff");

  // ✅ normalize discount type (percaya type kalau ada)
  const dt = normalizeDiscountType(discount_type, discount_value);

  // ✅ normalize discount value sesuai type
  let dVal = 0;
  if (dt === "percent") dVal = clampInt(discount_value ?? 0, 0, 100);
  else dVal = Math.max(0, Math.floor(num(discount_value ?? 0)));

  // ✅ tax percent only
  const tPct = clampInt(tax_value ?? 0, 0, 100);

  // ✅ normalize items
  const normItems: Item[] = (items as any[]).map((it: any) => ({
    name: String(it?.name || "").trim(),
    qty: Math.max(0, Math.floor(num(it?.qty))),
    price: Math.max(0, Math.floor(num(it?.price))),
  }));

  const { subtotal, discountAmount, taxAmount, total } = computeTotals(normItems, dt, dVal, tPct);

  // ✅ fetch quotation_number if quotation_id exists (RLS user client)
  // NOTE: kalau RLS quotations ketat dan invoice create boleh buat dari quotation,
  // query ini akan ikut RLS user (aman).
  let quotationNumber: string | null = null;
  if (quotation_id) {
    const { data: qRow, error: qErr } = await supabase
      .from("quotations")
      .select("quotation_number")
      .eq("id", quotation_id)
      .maybeSingle();

    if (!qErr && qRow?.quotation_number) quotationNumber = String(qRow.quotation_number);
  }

  // ✅ insert invoice (pastikan kolom ini ada di table invoices)
  const invoicePayload: any = {
    org_id: orgId,
    invoice_date: safeDateOrNull(invoice_date),
    due_date: safeDateOrNull(due_date),

    // pointers
    quotation_id: quotation_id || null,
    quotation_number: quotationNumber, // ✅ NEW

    customer_id: customer_id || null,
    customer_name: String(customer_name || "").trim(),
    customer_phone: String(customer_phone || ""),
    customer_address: String(customer_address || ""),
    note: String(note || ""),

    discount_type: dt,
    discount_value: dVal,
    tax_value: tPct,

    subtotal,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    total,

    created_by: user.id,
    amount_paid: 0,
    status: "draft", // ✅ sesuaikan: "draft" / "unpaid" sesuai enum kamu
  };

  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .insert(invoicePayload)
    .select("id, invoice_number, quotation_id, quotation_number")
    .single();

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 400 });

  // ✅ insert invoice items
  const payloadItems = normItems.map((it, idx) => ({
    invoice_id: inv.id,
    name: it.name,
    qty: it.qty,
    price: it.price,
    sort_order: idx,
  }));

  const { error: itemErr } = await supabase.from("invoice_items").insert(payloadItems);
  if (itemErr) {
    await supabase.from("invoices").delete().eq("id", inv.id);
    return NextResponse.json({ error: itemErr.message }, { status: 400 });
  }

  // ✅ LINK BACK TO QUOTATION (best-effort)
  if (quotation_id) {
    try {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );

      const { error: linkErr } = await admin
        .from("quotations")
        .update({
          invoice_id: inv.id,
          is_locked: true,
          status: "accepted",
        })
        .eq("id", quotation_id);

      if (linkErr) console.warn("link quotation -> invoice failed:", linkErr.message);
    } catch (e) {
      console.warn("link quotation -> invoice exception:", e);
    }
  }

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "invoice.create",
    entity_type: "invoice",
    entity_id: inv.id,
    summary: `Create invoice ${inv.invoice_number || inv.id}`,
    meta: {
      invoice_id: inv.id,
      invoice_number: inv.invoice_number ?? null,

      quotation_id: quotation_id || null,
      quotation_number: quotationNumber,

      discount_type: dt,
      discount_value: dVal,

      subtotal,
      discount_amount: discountAmount,
      tax_percent: tPct,
      tax_amount: taxAmount,
      total,

      due_date: safeDateOrNull(due_date),
      items_count: payloadItems.length,
      status: "draft",
    },
  });

  return NextResponse.json(
    {
      id: inv.id,
      invoice_number: inv.invoice_number ?? null,

      quotation_id: inv.quotation_id ?? null,
      quotation_number: inv.quotation_number ?? quotationNumber ?? null,

      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total,
    },
    { status: 200 }
  );
}
