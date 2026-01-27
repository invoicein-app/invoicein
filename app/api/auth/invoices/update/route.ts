// app/api/invoices/update/route.ts  (FULL REPLACE)
// ✅ Versi FINAL: TANPA discount_type / tax_type (pasti %)
// ✅ Activity log setelah RPC sukses

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { logActivity } from "@/lib/log-activity";

type UpdateInvoiceBody = {
  invoiceId?: string;
  header?: {
    customer_name?: string;
    customer_phone?: string;
    customer_address?: string;
    note?: string;
    invoice_date?: string; // "YYYY-MM-DD"
    invoice_number?: string; // optional (kalau RPC kamu izinkan admin)
    discount_value?: number | string; // ✅ PERSEN
    tax_value?: number | string; // ✅ PERSEN
    status?: string; // optional kalau kolom status masih ada (kalau sudah dihapus, jangan kirim)
  };
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

function text(v: any) {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();

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
  const body = (await req.json().catch(() => ({}))) as UpdateInvoiceBody;

  const invoiceId = text(body.invoiceId);
  const headerIn = (body.header || {}) as any;
  const itemsIn = Array.isArray(body.items) ? body.items : [];

  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId wajib" }, { status: 400 });
  }

  // minimal validasi items (kalau edit selalu kirim full items)
  if (!Array.isArray(itemsIn) || itemsIn.length === 0) {
    return NextResponse.json({ error: "items wajib (minimal 1)" }, { status: 400 });
  }

  for (const it of itemsIn) {
    if (!text(it?.name)) {
      return NextResponse.json({ error: "Item name wajib" }, { status: 400 });
    }
    if (!Number.isFinite(num(it?.qty))) {
      return NextResponse.json({ error: "Item qty invalid" }, { status: 400 });
    }
    if (!Number.isFinite(num(it?.price))) {
      return NextResponse.json({ error: "Item price invalid" }, { status: 400 });
    }
  }

  // ambil org + role utk activity log
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

  // ===== header FINAL (tanpa *_type) =====
  // NOTE:
  // - discount_value & tax_value = PERSEN (0-100)
  // - kalau kolom status sudah kamu hapus dari DB, hapus bagian status di bawah (biar gak ikut terkirim)
  const header = {
    customer_name: headerIn.customer_name,
    customer_phone: headerIn.customer_phone,
    customer_address: headerIn.customer_address,
    note: headerIn.note,
    invoice_date: headerIn.invoice_date,
    invoice_number: headerIn.invoice_number,
    discount_value: headerIn.discount_value != null ? num(headerIn.discount_value) : undefined,
    tax_value: headerIn.tax_value != null ? num(headerIn.tax_value) : undefined,
    // status: headerIn.status, // <-- UNCOMMENT cuma kalau kolom status masih ada di invoices
  };

  // buang undefined biar RPC gak bingung
  const cleanHeader: Record<string, any> = {};
  for (const [k, v] of Object.entries(header)) {
    if (v !== undefined) cleanHeader[k] = v;
  }

  // normalize items (selalu kirim sort_order)
  const cleanItems = itemsIn.map((it, idx) => ({
    name: text(it.name),
    qty: Math.max(0, num(it.qty)),
    price: Math.max(0, num(it.price)),
    sort_order: Number.isFinite(Number(it.sort_order)) ? Number(it.sort_order) : idx,
  }));

  // ===== RPC (transaksi + rules staff) =====
  // Pastikan function update_invoice_with_items kamu:
  // - update kolom discount_value & tax_value (numeric)
  // - sudah TIDAK pakai discount_type/tax_type lagi
  const { data, error } = await supabase.rpc("update_invoice_with_items", {
    p_invoice_id: invoiceId,
    p_header: cleanHeader,
    p_items: cleanItems,
  });

  if (error) {
    return NextResponse.json({ error: error.message, detail: error }, { status: 400 });
  }

  // ✅ Activity log (best-effort)
  const changedFields = Object.keys(cleanHeader || {});
  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "invoice.update",
    entity_type: "invoice",
    entity_id: invoiceId,
    summary: `Update invoice ${invoiceId}`,
    meta: {
      invoice_id: invoiceId,
      changed_fields: changedFields,
      items_count: cleanItems.length,
      header: {
        invoice_date: cleanHeader.invoice_date,
        customer_name: cleanHeader.customer_name,
        discount_value: cleanHeader.discount_value,
        tax_value: cleanHeader.tax_value,
        // status: cleanHeader.status, // <-- kalau status dipakai
      },
    },
  });

  return NextResponse.json({ ok: true, data }, { status: 200 });
}