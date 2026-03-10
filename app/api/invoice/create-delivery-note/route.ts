export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { requireCanWrite } from "@/lib/subscription";

type CookieToSet = { name: string; value: string; options: any };

function asText(v: any) {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest) {
  const cookieJar: CookieToSet[] = [];

  try {
    const { invoiceId } = (await req.json().catch(() => ({}))) as {
      invoiceId?: string;
    };

    if (!invoiceId) {
      return NextResponse.json({ error: "invoiceId wajib" }, { status: 400 });
    }

    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieJar.push({ name, value, options })
            );
          },
        },
      }
    );

    const { data: userRes, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr) {
      const response = NextResponse.json({ error: userErr.message }, { status: 401 });
      cookieJar.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options)
      );
      return response;
    }

    const user = userRes.user;
    if (!user) {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      cookieJar.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options)
      );
      return response;
    }

    const { data: inv, error: invErr } = await supabaseUser
      .from("invoices")
      .select(
        "id, org_id, customer_address, warehouse_id, status, invoice_number"
      )
      .eq("id", invoiceId)
      .maybeSingle();

    if (invErr) {
      const response = NextResponse.json(
        { error: invErr.message, detail: invErr },
        { status: 403 }
      );
      cookieJar.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options)
      );
      return response;
    }

    if (!inv) {
      const response = NextResponse.json(
        { error: "Invoice tidak ditemukan / forbidden" },
        { status: 404 }
      );
      cookieJar.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options)
      );
      return response;
    }

    if (!inv.org_id) {
      const response = NextResponse.json(
        { error: "Invoice org_id kosong" },
        { status: 400 }
      );
      cookieJar.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options)
      );
      return response;
    }

    const subBlock = await requireCanWrite(supabaseUser, inv.org_id);
    if (subBlock) {
      cookieJar.forEach(({ name, value, options }) =>
        subBlock.cookies.set(name, value, options)
      );
      return subBlock;
    }

    const invStatus = String(inv.status || "").toLowerCase();
    if (invStatus === "cancelled") {
      const response = NextResponse.json(
        { error: "Invoice cancelled tidak bisa dibuatkan surat jalan." },
        { status: 400 }
      );
      cookieJar.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options)
      );
      return response;
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const response = NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY belum di-set di .env.local" },
        { status: 500 }
      );
      cookieJar.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options)
      );
      return response;
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );

    const { data: existingDn, error: existingErr } = await admin
      .from("delivery_notes")
      .select("id")
      .eq("org_id", inv.org_id)
      .eq("invoice_id", invoiceId)
      .maybeSingle();

    if (existingErr) {
      const response = NextResponse.json(
        { error: existingErr.message, detail: existingErr },
        { status: 400 }
      );
      cookieJar.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options)
      );
      return response;
    }

    if (existingDn?.id) {
      const response = NextResponse.json(
        { id: existingDn.id, already_exists: true },
        { status: 200 }
      );
      cookieJar.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options)
      );
      return response;
    }

    const { data: items, error: itemsErr } = await admin
      .from("invoice_items")
      .select("name, qty, sort_order, product_id, item_key, unit")
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true });

    if (itemsErr) {
      const response = NextResponse.json(
        { error: itemsErr.message, detail: itemsErr },
        { status: 400 }
      );
      cookieJar.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options)
      );
      return response;
    }

    const productIds = [...new Set((items || []).map((it: any) => asText(it.product_id)).filter(Boolean))];

    let productUnitMap = new Map<string, string | null>();

    if (productIds.length > 0) {
      const { data: products, error: prodErr } = await admin
        .from("products")
        .select("id, unit")
        .in("id", productIds);

      if (prodErr) {
        const response = NextResponse.json(
          { error: prodErr.message, detail: prodErr },
          { status: 400 }
        );
        cookieJar.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        return response;
      }

      productUnitMap = new Map(
        (products || []).map((p: any) => [String(p.id), asText(p.unit) || null])
      );
    }

    const insertPayload = {
      org_id: inv.org_id,
      invoice_id: invoiceId,
      sj_date: new Date().toISOString().slice(0, 10),
      warehouse_id: inv.warehouse_id || null,
      shipping_address: inv.customer_address || "",
      driver_name: "",
      note: "",
      status: "draft",
      created_by: user.id,
    };

    const { data: createdDnRow, error: dnInsertErr } = await supabaseUser
      .from("delivery_notes")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();

    let deliveryNoteId: string | null = createdDnRow?.id ?? null;

    if (dnInsertErr) {
      if (String((dnInsertErr as any).code) === "23505") {
        const { data: dn2, error: dn2Err } = await admin
          .from("delivery_notes")
          .select("id")
          .eq("org_id", inv.org_id)
          .eq("invoice_id", invoiceId)
          .maybeSingle();

        if (dn2Err || !dn2?.id) {
          const response = NextResponse.json(
            { error: dn2Err?.message || "Duplicate but cannot fetch existing SJ" },
            { status: 400 }
          );
          cookieJar.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
          return response;
        }

        const response = NextResponse.json(
          { id: dn2.id, already_exists: true },
          { status: 200 }
        );
        cookieJar.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        return response;
      }

      const response = NextResponse.json(
        { error: dnInsertErr.message, detail: dnInsertErr },
        { status: 400 }
      );
      cookieJar.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options)
      );
      return response;
    }

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
        const response = NextResponse.json(
          { error: lastDnErr?.message || "SJ dibuat, tapi gagal ambil id" },
          { status: 500 }
        );
        cookieJar.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        return response;
      }

      deliveryNoteId = lastDn.id;
    }

    if ((items || []).length) {
      const payload = (items || []).map((it: any, i: number) => {
        const productId = asText(it.product_id) || null;
        const unitFromInvoice = asText(it.unit) || null;
        const unitFromProduct = productId ? productUnitMap.get(productId) || null : null;

        return {
          delivery_note_id: deliveryNoteId,
          name: it.name,
          qty: it.qty,
          sort_order: it.sort_order ?? i,
          unit: unitFromInvoice || unitFromProduct || null,
          product_id: productId,
          item_key: asText(it.item_key) || null,
        };
      });

      const { error: dnItemsErr } = await admin
        .from("delivery_note_items")
        .insert(payload);

      if (dnItemsErr) {
        const response = NextResponse.json(
          { error: dnItemsErr.message, detail: dnItemsErr },
          { status: 400 }
        );
        cookieJar.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        return response;
      }
    }

    const response = NextResponse.json(
      { id: deliveryNoteId, already_exists: false },
      { status: 200 }
    );
    cookieJar.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options)
    );
    return response;
  } catch (e: any) {
    const response = NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
    cookieJar.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options)
    );
    return response;
  }
}