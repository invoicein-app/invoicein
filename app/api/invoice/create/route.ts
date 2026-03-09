export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { logActivity } from "@/lib/log-activity";

type Item = {
  product_id: string;
  name: string;
  item_key: string;
  qty: number;
  price: number;
  unit: string | null;
};

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

function toKey(raw: string) {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "";
}

function normalizeDiscountType(
  discount_type: any,
  discount_value: any
): "percent" | "amount" {
  const raw = String(discount_type ?? "").trim().toLowerCase();

  if (raw === "amount" || raw === "fixed") return "amount";
  if (raw === "percent" || raw === "percentage") return "percent";

  const v = Math.floor(num(discount_value));
  return v > 100 ? "amount" : "percent";
}

function computeTotals(
  items: Item[],
  dt: "percent" | "amount",
  dVal: number,
  taxPct: number
) {
  const subtotal = items.reduce((a, it) => a + it.qty * it.price, 0);

  let discountAmount =
    dt === "percent"
      ? Math.floor(subtotal * (dVal / 100))
      : Math.floor(dVal);

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

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = userRes.user;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

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

    warehouse_id,
    items,
  } = body as any;

  if (!String(customer_name || "").trim()) {
    return NextResponse.json(
      { error: "Customer name wajib diisi." },
      { status: 400 }
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Minimal 1 item." }, { status: 400 });
  }

  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("org_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 400 });
  }

  if (!membership?.org_id) {
    return NextResponse.json(
      { error: "Kamu belum punya organisasi aktif." },
      { status: 400 }
    );
  }

  const orgId = String(membership.org_id);
  const actorRole = String((membership as any).role || "staff");

  const dt = normalizeDiscountType(discount_type, discount_value);

  let dVal = 0;
  if (dt === "percent") dVal = clampInt(discount_value ?? 0, 0, 100);
  else dVal = Math.max(0, Math.floor(num(discount_value ?? 0)));

  const tPct = clampInt(tax_value ?? 0, 0, 100);

  const normItems: Item[] = (items as any[]).map((it: any) => ({
    product_id: String(it?.product_id || "").trim(),
    name: String(it?.name || "").trim(),
    item_key: toKey(String(it?.item_key || "").trim()),
    qty: Math.max(0, Math.floor(num(it?.qty))),
    price: Math.max(0, Math.floor(num(it?.price))),
    unit: null,
  }));

  const badIndex = normItems.findIndex(
    (it) =>
      !it.product_id ||
      !it.name ||
      !it.item_key ||
      !Number.isFinite(it.qty) ||
      it.qty <= 0
  );

  if (badIndex >= 0) {
    return NextResponse.json(
      { error: `Item baris ${badIndex + 1} wajib pilih dari master barang.` },
      { status: 400 }
    );
  }

  const productIds = [...new Set(normItems.map((it) => it.product_id))];

  const { data: dbProducts, error: prodErr } = await supabase
    .from("products")
    .select("id, org_id, name, sku, unit")
    .eq("org_id", orgId)
    .in("id", productIds);

  if (prodErr) {
    return NextResponse.json({ error: prodErr.message }, { status: 400 });
  }

  const productMap = new Map(
    (dbProducts || []).map((p: any) => [String(p.id), p])
  );

  for (let i = 0; i < normItems.length; i++) {
    const it = normItems[i];
    const p: any = productMap.get(it.product_id);

    if (!p) {
      return NextResponse.json(
        { error: `Item baris ${i + 1}: product tidak ditemukan.` },
        { status: 400 }
      );
    }

    const expectedKey = toKey(
      String(p.sku || "").trim() || String(p.name || "").trim()
    );

    if (it.item_key !== expectedKey) {
      return NextResponse.json(
        { error: `Item baris ${i + 1}: item_key tidak cocok dengan product.` },
        { status: 400 }
      );
    }

    if (it.name !== String(p.name || "").trim()) {
      return NextResponse.json(
        { error: `Item baris ${i + 1}: nama item harus sama dengan master barang.` },
        { status: 400 }
      );
    }

    it.unit = String(p.unit || "").trim() || null;
  }

  const { subtotal, discountAmount, taxAmount, total } = computeTotals(
    normItems,
    dt,
    dVal,
    tPct
  );

  let quotationNumber: string | null = null;
  if (quotation_id) {
    const { data: qRow, error: qErr } = await supabase
      .from("quotations")
      .select("quotation_number")
      .eq("id", quotation_id)
      .maybeSingle();

    if (!qErr && qRow?.quotation_number) {
      quotationNumber = String(qRow.quotation_number);
    }
  }

  const invoicePayload: any = {
    org_id: orgId,
    invoice_date: safeDateOrNull(invoice_date),
    due_date: safeDateOrNull(due_date),

    quotation_id: quotation_id || null,
    quotation_number: quotationNumber,

    customer_id: customer_id || null,
    customer_name: String(customer_name || "").trim(),
    customer_phone: String(customer_phone || ""),
    customer_address: String(customer_address || ""),
    note: String(note || ""),

    discount_type: dt,
    discount_value: dVal,
    tax_value: tPct,
    warehouse_id: warehouse_id || null,

    subtotal,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    total,

    created_by: user.id,
    amount_paid: 0,
    status: "draft",
  };

  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .insert(invoicePayload)
    .select("id, invoice_number, quotation_id, quotation_number")
    .single();

  if (invErr) {
    return NextResponse.json({ error: invErr.message }, { status: 400 });
  }

  const payloadItems = normItems.map((it, idx) => ({
    invoice_id: inv.id,
    product_id: it.product_id,
    item_key: it.item_key,
    name: it.name,
    unit: it.unit,
    qty: it.qty,
    price: it.price,
    sort_order: idx,
  }));

  const { error: itemErr } = await supabase
    .from("invoice_items")
    .insert(payloadItems);

  if (itemErr) {
    await supabase.from("invoices").delete().eq("id", inv.id);
    return NextResponse.json({ error: itemErr.message }, { status: 400 });
  }

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

      if (linkErr) {
        console.warn("link quotation -> invoice failed:", linkErr.message);
      }
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
      warehouse_id: warehouse_id || null,
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