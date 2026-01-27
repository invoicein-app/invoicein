// invoiceku/app/api/invoices/[id]/route.ts
// FULL REPLACE
// ✅ Next.js params async
// ✅ PATCH /api/invoices/:id
// ✅ FIX: body dari FE kamu itu "invoice" (bukan "header")
// ✅ FIX: percent-only (hapus discount_type / tax_type)
// ✅ FIX: jangan pernah kirim "unpaid" ke enum invoice_status (kalau kolom status masih ada)
// ✅ PLUS: activity log invoice.update

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { logActivity } from "@/lib/log-activity";

type UpdateInvoiceBody = {
  // FE kamu kirim: { invoice: {...}, items: [...] }
  invoice?: {
    customer_name?: string;
    customer_phone?: string;
    customer_address?: string;
    note?: string;
    invoice_date?: string; // "YYYY-MM-DD"
    invoice_number?: string; // admin only (kalau RPC izinkan)
    discount_value?: number | string; // ✅ persen
    tax_value?: number | string; // ✅ persen
    status?: string; // optional kalau masih ada di DB (tapi JANGAN "unpaid")
  };
  // support juga kalau ada yang masih kirim "header"
  header?: any;

  items?: Array<{
    name: string;
    qty: number | string;
    price: number | string;
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

function clampPct(v: any) {
  const n = num(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
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

  // ✅ ambil header dari invoice (utama), fallback ke header (legacy)
  const headerIn = (body.invoice ?? body.header ?? {}) as any;
  const itemsIn = Array.isArray(body.items) ? body.items : [];

  // validate items
  if (!Array.isArray(itemsIn) || itemsIn.length === 0) {
    return NextResponse.json({ error: "items wajib (minimal 1)" }, { status: 400 });
  }

  for (const it of itemsIn) {
    if (!asText(it?.name)) {
      return NextResponse.json({ error: "Item name wajib" }, { status: 400 });
    }
    if (!Number.isFinite(num(it?.qty))) {
      return NextResponse.json({ error: "Item qty invalid" }, { status: 400 });
    }
    if (!Number.isFinite(num(it?.price))) {
      return NextResponse.json({ error: "Item price invalid" }, { status: 400 });
    }
  }

  // Membership (org + role)
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

  // optional invoice_number utk log
  const { data: invRow } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("id", invoiceId)
    .maybeSingle();

  const invoiceNumber = (invRow as any)?.invoice_number ?? null;

  // ===== header CLEAN (percent-only) =====
  // penting: JANGAN kirim discount_type / tax_type lagi.
  // penting: JANGAN kirim status "unpaid" ke enum invoice_status.
  const cleanHeader: Record<string, any> = {};

  if (headerIn.customer_name !== undefined) cleanHeader.customer_name = asText(headerIn.customer_name);
  if (headerIn.customer_phone !== undefined) cleanHeader.customer_phone = asText(headerIn.customer_phone);
  if (headerIn.customer_address !== undefined) cleanHeader.customer_address = asText(headerIn.customer_address);
  if (headerIn.note !== undefined) cleanHeader.note = headerIn.note ?? "";

  if (headerIn.invoice_date !== undefined) cleanHeader.invoice_date = asText(headerIn.invoice_date);
  if (headerIn.invoice_number !== undefined) cleanHeader.invoice_number = asText(headerIn.invoice_number);

  if (headerIn.discount_value !== undefined) cleanHeader.discount_value = clampPct(headerIn.discount_value);
  if (headerIn.tax_value !== undefined) cleanHeader.tax_value = clampPct(headerIn.tax_value);

  // OPTIONAL: kalau kolom status MASIH ADA dan kamu mau allow update status,
  // pastikan nilai yang dikirim hanya yang valid di enum kamu (mis. "draft"|"sent"|"paid")
  // dan JANGAN "unpaid".
  if (headerIn.status !== undefined) {
    const s = asText(headerIn.status);
    if (s && s !== "unpaid") {
      cleanHeader.status = s;
    }
  }

  // ===== items CLEAN (selalu kirim sort_order) =====
  const cleanItems = itemsIn.map((it, idx) => ({
    name: asText(it.name),
    qty: Math.max(0, num(it.qty)),
    price: Math.max(0, num(it.price)),
    sort_order: Number.isFinite(Number(it.sort_order)) ? Number(it.sort_order) : idx,
  }));

  // RPC
  const { data, error } = await supabase.rpc("update_invoice_with_items", {
    p_invoice_id: invoiceId,
    p_header: cleanHeader,
    p_items: cleanItems,
  });

  if (error) {
    return NextResponse.json({ error: error.message, detail: error }, { status: 400 });
  }

  // activity log (best-effort)
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
      changed_fields: Object.keys(cleanHeader),
      items_count: cleanItems.length,
      header: {
        invoice_date: cleanHeader.invoice_date,
        customer_name: cleanHeader.customer_name,
        discount_value: cleanHeader.discount_value,
        tax_value: cleanHeader.tax_value,
        status: cleanHeader.status,
      },
    },
  });

  return NextResponse.json({ ok: true, data }, { status: 200 });
}

// optional GET (debug)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json({ ok: true, id }, { status: 200 });
}