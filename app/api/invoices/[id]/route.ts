// invoiceku/app/api/invoices/[id]/route.ts
// PATCH /api/invoices/:id
// FIX: sanitize header biar gak ada status "unpaid" nyasar ke enum invoice_status
// PLUS: activity log invoice.update

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { logActivity } from "@/lib/log-activity";

type UpdateInvoiceBody = {
  header?: Record<string, any>;
  items?: Array<{
    name: string;
    qty: number;
    price: number;
    sort_order?: number;
  }>;
};

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asText(v: any) {
  return String(v ?? "").trim();
}

// ✅ whitelist header yang boleh diupdate (ini penting!)
function pickSafeHeader(raw: Record<string, any>) {
  const h = raw || {};

  // ambil hanya field yang kamu izinkan
  const safe: Record<string, any> = {
    customer_name: h.customer_name,
    customer_phone: h.customer_phone,
    customer_address: h.customer_address,
    note: h.note,
    invoice_date: h.invoice_date,

    // kalau kamu mau izinkan invoice_number via RPC admin-only
    invoice_number: h.invoice_number,
    discount_value: h.discount_value,
    tax_value: h.tax_value,
  };

  // normalize string kosong -> null (optional)
  for (const k of ["customer_phone", "customer_address", "note", "invoice_number"] as const) {
    if (safe[k] != null && String(safe[k]).trim() === "") safe[k] = "";
  }

  // normalize numeric
  if (safe.discount_value != null) safe.discount_value = num(safe.discount_value);
  if (safe.tax_value != null) safe.tax_value = num(safe.tax_value);

  // 🔥 PENTING: jangan pernah kirim status ke RPC (biar gak nabrak enum)
  delete safe.status;
  delete safe.payStatus;
  delete safe.remaining;
  delete safe.grandTotal;
  delete safe.paid;
  delete safe.amount_paid;
  delete safe.discount_type;
  delete safe.tax_type;

  return safe;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invoiceId = asText(id);

  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoice id" }, { status: 400 });
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

  // Auth
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = userRes.user;

  // Body
  const body = (await req.json().catch(() => null)) as UpdateInvoiceBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawHeader = (body.header || {}) as Record<string, any>;
  const items = Array.isArray(body.items) ? body.items : [];

  // Minimal validate items (kalau edit selalu kirim items penuh)
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items wajib (minimal 1)" }, { status: 400 });
  }

  for (const it of items) {
    if (!asText(it?.name)) return NextResponse.json({ error: "Item name wajib" }, { status: 400 });
    if (!Number.isFinite(num(it.qty))) return NextResponse.json({ error: "Item qty invalid" }, { status: 400 });
    if (!Number.isFinite(num(it.price))) return NextResponse.json({ error: "Item price invalid" }, { status: 400 });
  }

  // Membership (org + role) untuk log + RLS
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
  const actorRole = String(membership.role || "staff");

  // ambil nomor invoice untuk summary/meta
  const { data: invRow } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("id", invoiceId)
    .maybeSingle();

  const invoiceNumber = (invRow as any)?.invoice_number ?? null;

  // ✅ sanitize header (buang status/unpaid dll)
  const safeHeader = pickSafeHeader(rawHeader);

  // ✅ RPC transaksi
  const { data, error } = await supabase.rpc("update_invoice_with_items", {
    p_invoice_id: invoiceId,
    p_header: safeHeader,
    p_items: items,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message, detail: error },
      { status: 400 }
    );
  }

  // ✅ Activity log (jangan bikin request utama gagal kalau log gagal)
  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "invoice.update",
    entity_type: "invoice",
    entity_id: invoiceId,
    summary: `Update invoice ${invoiceNumber || invoiceId}`,
    meta: {
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      header: safeHeader,
      items_count: items.length,
    },
  });

  return NextResponse.json({ ok: true, data }, { status: 200 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json({ ok: true, id }, { status: 200 });
}