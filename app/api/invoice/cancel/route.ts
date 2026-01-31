// ✅ FULL REPLACE FILE
// invoiceku/app/api/invoice/cancel/route.ts
//
// POST /api/invoice/cancel
// body: { invoice_id: string, reason?: string }
//
// Rules (human-friendly, tapi tetap profesional):
// - boleh cancel kalau status invoice: draft | sent | unpaid
// - TIDAK boleh cancel kalau status = paid atau sudah ada pembayaran (amount_paid > 0)
// - kalau invoice punya quotation_id -> quotations.status ikut jadi 'cancelled' + is_locked tetap true
// - kalau ada quotations.invoice_id = invoice_id (fallback legacy) -> ikut cancel juga
// - tetap pakai org_id filter (membership) biar aman multi-tenant
//
// NOTE: enum invoice_status & quotation_status HARUS sudah ada 'cancelled'

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { logActivity } from "@/lib/log-activity";

function isUuid(v: any) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || "")
  );
}

export async function POST(req: Request) {
  // ✅ cookies compat (Next 15)
  const csAny: any = cookies() as any;
  const cookieStore: any = csAny?.then ? await csAny : csAny;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: any[]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
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

  const invoice_id = String(body?.invoice_id || "").trim();
  const reason = String(body?.reason || "").trim();

  if (!isUuid(invoice_id)) {
    return NextResponse.json({ error: "invoice_id tidak valid." }, { status: 400 });
  }

  // membership
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

  // load invoice (pastikan milik org ini)
  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .select("id, org_id, invoice_number, status, amount_paid, quotation_id")
    .eq("id", invoice_id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 400 });
  if (!inv) {
    return NextResponse.json({ error: "Invoice tidak ditemukan / tidak punya akses." }, { status: 404 });
  }

  const status = String((inv as any).status || "").toLowerCase();
  const amountPaid = Number((inv as any).amount_paid || 0);

  // hard rules
  if (status === "cancelled") {
    return NextResponse.json({ error: "Invoice ini sudah cancelled." }, { status: 400 });
  }
  if (status === "paid" || amountPaid > 0) {
    return NextResponse.json(
      { error: "Tidak bisa cancel invoice yang sudah ada pembayaran. (lebih aman pakai refund/credit note nanti)" },
      { status: 400 }
    );
  }
  if (!["draft", "sent", "unpaid"].includes(status)) {
    return NextResponse.json(
      { error: `Status invoice tidak bisa dicancel: ${status || "-"}` },
      { status: 400 }
    );
  }

  // ✅ cancel invoice
  const { error: updErr } = await supabase
    .from("invoices")
    .update({
      status: "cancelled",
      // optional: kamu bisa set paid_at null, tapi karena amount_paid=0, biarin aja
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoice_id)
    .eq("org_id", orgId);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

  // ✅ cancel quotation terkait (2 jalur: quotation_id di invoice, atau quotations.invoice_id legacy)
  let quotationId: string | null = null;
  let quotationNumber: string | null = null;

  try {
    const qId = String((inv as any).quotation_id || "").trim();

    // A) kalau invoices.quotation_id ada -> update row itu
    if (isUuid(qId)) {
      const { data: qRow } = await supabase
        .from("quotations")
        .select("id, quotation_number")
        .eq("id", qId)
        .maybeSingle();

      if (qRow?.id) {
        quotationId = String(qRow.id);
        quotationNumber = (qRow as any).quotation_number ?? null;

        await supabase
          .from("quotations")
          .update({
            status: "cancelled",
            // invoice_id biarkan tetap ada biar audit rapi (one-way)
            updated_at: new Date().toISOString(),
          })
          .eq("id", quotationId);
      }
    } else {
      // B) fallback: cari quotation yang invoice_id = invoice_id
      const { data: qRow2 } = await supabase
        .from("quotations")
        .select("id, quotation_number")
        .eq("invoice_id", invoice_id)
        .limit(1)
        .maybeSingle();

      if (qRow2?.id) {
        quotationId = String(qRow2.id);
        quotationNumber = (qRow2 as any).quotation_number ?? null;

        await supabase
          .from("quotations")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", quotationId);
      }
    }
  } catch {
    // best-effort: jangan gagalkan cancel invoice kalau update quotation gagal
  }

  // activity log
  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "invoice.cancel",
    entity_type: "invoice",
    entity_id: invoice_id,
    summary: `Cancel invoice ${(inv as any).invoice_number || invoice_id}`,
    meta: {
      invoice_id,
      invoice_number: (inv as any).invoice_number ?? null,
      prev_status: status,
      new_status: "cancelled",
      reason: reason || null,
      quotation_id: quotationId,
      quotation_number: quotationNumber,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      invoice_id,
      invoice_number: (inv as any).invoice_number ?? null,
      status: "cancelled",
      quotation_id: quotationId,
      quotation_number: quotationNumber,
    },
    { status: 200 }
  );
}
