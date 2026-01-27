export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function calcGrandTotal(inv: any) {
  const items = inv.invoice_items || [];
  const subtotal =
    items.reduce(
      (acc: number, it: any) =>
        acc + Number(it.qty || 0) * Number(it.price || 0),
      0
    ) || 0;

  const discount =
    inv.discount_type === "percent"
      ? subtotal * (Number(inv.discount_value || 0) / 100)
      : Number(inv.discount_value || 0);

  const afterDisc = Math.max(0, subtotal - Math.max(0, discount));

  const tax =
    inv.tax_type === "percent"
      ? afterDisc * (Number(inv.tax_value || 0) / 100)
      : Number(inv.tax_value || 0);

  const grandTotal = Math.max(0, afterDisc + Math.max(0, tax));
  return grandTotal;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const invoiceId = String(body?.invoiceId || "");
    const amount = Number(body?.amount || 0);

    if (!invoiceId) {
      return NextResponse.json({ error: "invoiceId wajib" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount harus > 0" }, { status: 400 });
    }

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

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ambil invoice + items untuk hitung total (RLS akan menyaring milik user)
    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .select(
        `
        id,
        status,
        amount_paid,
        discount_type,
        discount_value,
        tax_type,
        tax_value,
        invoice_items ( qty, price )
      `
      )
      .eq("id", invoiceId)
      .single();

    if (invErr || !inv) {
      return NextResponse.json({ error: invErr?.message || "Invoice not found" }, { status: 404 });
    }

    const grandTotal = calcGrandTotal(inv);
    const oldPaid = Math.max(0, Number(inv.amount_paid || 0));
    const newPaid = oldPaid + amount;

    // update amount_paid
    const updatePayload: any = {
      amount_paid: newPaid,
    };

    // kalau sudah lunas -> set status invoice jadi paid (opsional tapi enak)
    if (grandTotal > 0 && newPaid >= grandTotal) {
      updatePayload.status = "paid";
    }

    const { data: updated, error: upErr } = await supabase
      .from("invoices")
      .update(updatePayload)
      .eq("id", invoiceId)
      .select("id, status, amount_paid")
      .single();

    if (upErr || !updated) {
      return NextResponse.json({ error: upErr?.message || "Update failed" }, { status: 400 });
    }

    const paid = Math.max(0, Number(updated.amount_paid || 0));
    const remaining = Math.max(0, grandTotal - paid);

    const payStatus =
      grandTotal <= 0 ? "UNPAID" : paid >= grandTotal ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";

    return NextResponse.json({
      ok: true,
      invoiceId,
      grandTotal,
      paid,
      remaining,
      payStatus,
      status: updated.status,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}