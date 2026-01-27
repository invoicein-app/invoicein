// ✅ FULL REPLACE
// app/api/invoice/create-delivery-note/route.ts
// - Anti duplicate (org_id, invoice_id) => get-or-create
// - Kebal double click / request 2x (handle 23505)
// - Tetap pakai supabaseUser untuk INSERT delivery_notes (biar trigger auth.uid() aman)
// - Copy items hanya kalau SJ baru dibuat (kalau sudah ada, jangan copy lagi)

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: any };

export async function POST(req: NextRequest) {
  const cookieJar: CookieToSet[] = [];

  try {
    const { invoiceId } = (await req.json().catch(() => ({}))) as { invoiceId?: string };
    if (!invoiceId) return NextResponse.json({ error: "invoiceId wajib" }, { status: 400 });

    // ✅ USER SESSION CLIENT (RLS ON)
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieJar.push({ name, value, options }));
          },
        },
      }
    );

    // ✅ AUTH
    const { data: userRes, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr) {
      const response = NextResponse.json({ error: userErr.message }, { status: 401 });
      cookieJar.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      return response;
    }
    const user = userRes.user;
    if (!user) {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      cookieJar.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      return response;
    }

    // ✅ READ INVOICE (RLS gate)
    const { data: inv, error: invErr } = await supabaseUser
      .from("invoices")
      .select("id, org_id, customer_address")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invErr) {
      const response = NextResponse.json({ error: invErr.message, detail: invErr }, { status: 403 });
      cookieJar.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      return response;
    }
    if (!inv) {
      const response = NextResponse.json({ error: "Invoice tidak ditemukan / forbidden" }, { status: 404 });
      cookieJar.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      return response;
    }
    if (!inv.org_id) {
      const response = NextResponse.json({ error: "Invoice org_id kosong" }, { status: 400 });
      cookieJar.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      return response;
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const response = NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY belum di-set di .env.local" }, { status: 500 });
      cookieJar.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      return response;
    }

    // ✅ ADMIN CLIENT (bypass RLS)
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ✅ GET-OR-CREATE: cek dulu existing SJ by (org_id, invoice_id)
    const { data: existingDn, error: existingErr } = await admin
      .from("delivery_notes")
      .select("id")
      .eq("org_id", inv.org_id)
      .eq("invoice_id", invoiceId)
      .maybeSingle();

    if (existingErr) {
      const response = NextResponse.json({ error: existingErr.message, detail: existingErr }, { status: 400 });
      cookieJar.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      return response;
    }

    // ✅ kalau sudah ada => return existing (jangan copy items lagi)
    if (existingDn?.id) {
      const response = NextResponse.json({ id: existingDn.id, already_exists: true }, { status: 200 });
      cookieJar.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      return response;
    }

    // ✅ ambil invoice_items (buat dicopy) — ambil sekarang juga gpp
    const { data: items, error: itemsErr } = await admin
      .from("invoice_items")
      .select("name, qty, sort_order")
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true });

    if (itemsErr) {
      const response = NextResponse.json({ error: itemsErr.message, detail: itemsErr }, { status: 400 });
      cookieJar.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      return response;
    }

    // ✅ INSERT SJ (pakai supabaseUser biar trigger auth.uid() aman)
    const insertPayload = {
      org_id: inv.org_id,
      invoice_id: invoiceId,
      sj_date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
      shipping_address: inv.customer_address || "",
      driver_name: "",
      note: "",
      created_by: user.id,
    };

    const { data: createdDnRow, error: dnInsertErr } = await supabaseUser
      .from("delivery_notes")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();

    // ✅ kalau insert sukses dan RLS mengizinkan select
    let deliveryNoteId: string | null = createdDnRow?.id ?? null;

    if (dnInsertErr) {
      // ✅ Duplicate (double click / sudah ada)
      if (String((dnInsertErr as any).code) === "23505") {
        const { data: dn2, error: dn2Err } = await admin
          .from("delivery_notes")
          .select("id")
          .eq("org_id", inv.org_id)
          .eq("invoice_id", invoiceId)
          .maybeSingle();

        if (dn2Err || !dn2?.id) {
          const response = NextResponse.json({ error: dn2Err?.message || "Duplicate but cannot fetch existing SJ" }, { status: 400 });
          cookieJar.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          return response;
        }

        const response = NextResponse.json({ id: dn2.id, already_exists: true }, { status: 200 });
        cookieJar.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        return response;
      }

      // error lain
      const response = NextResponse.json({ error: dnInsertErr.message, detail: dnInsertErr }, { status: 400 });
      cookieJar.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      return response;
    }

    // ✅ kalau deliveryNoteId null (karena RLS blok select), ambil via admin
    if (!deliveryNoteId) {
      const { data: lastDn, error: lastDnErr } = await admin
        .from("delivery_notes")
        .select("id")
        .eq("org_id", inv.org_id)
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastDnErr || !lastDn?.id) {
        const response = NextResponse.json({ error: lastDnErr?.message || "SJ dibuat, tapi gagal ambil id" }, { status: 500 });
        cookieJar.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        return response;
      }

      deliveryNoteId = lastDn.id;
    }

    // ✅ COPY ITEMS → delivery_note_items (hanya untuk SJ baru)
    if ((items || []).length) {
      const payload = (items || []).map((it: any, i: number) => ({
        delivery_note_id: deliveryNoteId,
        name: it.name,
        qty: it.qty,
        sort_order: it.sort_order ?? i,
      }));

      const { error: dnItemsErr } = await admin.from("delivery_note_items").insert(payload);
      if (dnItemsErr) {
        const response = NextResponse.json({ error: dnItemsErr.message, detail: dnItemsErr }, { status: 400 });
        cookieJar.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        return response;
      }
    }

    const response = NextResponse.json({ id: deliveryNoteId, already_exists: false }, { status: 200 });
    cookieJar.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  } catch (e: any) {
    const response = NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
    cookieJar.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  }
}