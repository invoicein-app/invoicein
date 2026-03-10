export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireCanWrite } from "@/lib/subscription";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clampPercent(v: any) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.floor(n)));
}

function safeInt(v: any) {
  const n = Math.floor(Number(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function computeInvoiceTotal(invoice: any, items: any[]) {
  const subtotal =
    (items || []).reduce(
      (acc, it: any) => acc + Number(it.qty || 0) * Number(it.price || 0),
      0
    ) || 0;

  const dtRaw = String(invoice?.discount_type || "percent").toLowerCase();
  const discountType: "percent" | "amount" =
    dtRaw === "amount" || dtRaw === "fixed" ? "amount" : "percent";

  const rawDiscountValue = safeInt(invoice?.discount_value);
  const discPct = discountType === "percent" ? clampPercent(rawDiscountValue) : 0;

  const discount =
    discountType === "percent"
      ? Math.max(0, Math.floor(subtotal * (discPct / 100)))
      : Math.max(0, Math.min(subtotal, Math.floor(rawDiscountValue)));

  const taxPct = clampPercent(invoice?.tax_value);
  const afterDisc = Math.max(0, subtotal - discount);
  const tax = Math.max(0, Math.floor(afterDisc * (taxPct / 100)));
  const total = Math.max(0, afterDisc + tax);

  return { subtotal, discount, tax, total };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);

  const { data, error } = await supabase
    .from("invoice_payments")
    .select("id, invoice_id, paid_at, amount, note, created_at")
    .eq("invoice_id", invoiceId)
    .order("paid_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return json({ error: error.message }, 400);

  return json({ payments: data || [] }, 200);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const paid_at = String(body.paid_at || "").slice(0, 10);
  const amount = Math.floor(Math.max(0, num(body.amount)));
  const note = String(body.note || "").trim();

  if (!paid_at) return json({ error: "paid_at wajib diisi" }, 400);
  if (!amount || amount <= 0) return json({ error: "amount harus > 0" }, 400);

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("id, org_id, status, discount_type, discount_value, tax_value, amount_paid")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invErr) return json({ error: invErr.message }, 400);
  if (!invoice) return json({ error: "Invoice tidak ditemukan" }, 404);

  const orgId = (invoice as any).org_id;
  if (orgId) {
    const subBlock = await requireCanWrite(supabase, orgId);
    if (subBlock) return subBlock;
  }

  const status = String(invoice.status || "").toLowerCase();

  if (status === "draft") {
    return json({ error: "Invoice draft belum bisa menerima pembayaran." }, 400);
  }

  if (status === "cancelled") {
    return json({ error: "Invoice cancelled tidak bisa dibayar." }, 400);
  }

  if (status === "paid") {
    return json({ error: "Invoice ini sudah lunas." }, 400);
  }

  const { data: items, error: itemsErr } = await supabase
    .from("invoice_items")
    .select("qty, price")
    .eq("invoice_id", invoiceId);

  if (itemsErr) return json({ error: itemsErr.message }, 400);

  const totals = computeInvoiceTotal(invoice, items || []);
  const currentPaid = Math.max(0, Math.floor(num(invoice.amount_paid || 0)));
  const remaining = Math.max(0, totals.total - currentPaid);

  if (remaining <= 0) {
    return json({ error: "Invoice ini sudah lunas." }, 400);
  }

  if (amount > remaining) {
    return json(
      {
        error: `Pembayaran melebihi sisa tagihan. Sisa saat ini Rp ${remaining.toLocaleString("id-ID")}.`,
      },
      400
    );
  }

  const { data: inserted, error: insErr } = await supabase
    .from("invoice_payments")
    .insert({
      invoice_id: invoiceId,
      paid_at,
      amount,
      note,
    })
    .select("id")
    .single();

  if (insErr) return json({ error: insErr.message }, 400);

  const { data: allPayments, error: payErr } = await supabase
    .from("invoice_payments")
    .select("amount")
    .eq("invoice_id", invoiceId);

  if (payErr) return json({ error: payErr.message }, 400);

  const nextAmountPaid = Math.max(
    0,
    Math.floor((allPayments || []).reduce((acc: number, p: any) => acc + num(p.amount), 0))
  );

  const nextStatus = nextAmountPaid >= totals.total ? "paid" : "sent";

  const { error: updErr } = await supabase
    .from("invoices")
    .update({
      amount_paid: nextAmountPaid,
      status: nextStatus,
    })
    .eq("id", invoiceId);

  if (updErr) return json({ error: updErr.message }, 400);

  return json(
    {
      ok: true,
      id: inserted?.id,
      amount_paid: nextAmountPaid,
      grand_total: totals.total,
      remaining: Math.max(0, totals.total - nextAmountPaid),
      status: nextStatus,
      ui_payment_state:
        nextAmountPaid <= 0
          ? "unpaid"
          : nextAmountPaid >= totals.total
          ? "paid"
          : "partial",
    },
    200
  );
}