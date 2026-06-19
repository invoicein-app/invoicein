export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiContext, asText } from "@/lib/api-context";
import { coerceDateOrToday } from "@/lib/document-numbering";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { createDeliveryNoteFromInvoiceBodySchema } from "@/lib/validations/delivery-note";
import { createAndFinalizeDeliveryNote, rollbackDeliveryNoteCreate } from "@/lib/delivery-note-post";

export async function POST(req: NextRequest) {
  try {
    const parsedBody = await parseJsonBody(req, createDeliveryNoteFromInvoiceBodySchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { invoiceId, sj_date, note } = parsedBody.data;

    const auth = await requireApiContext({ requireWrite: true });
    if (!auth.ok) return auth.response;

    const { supabase, user, orgId, actorRole } = auth.ctx;

    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .select(
        "id, org_id, customer_address, customer_name, customer_phone, warehouse_id, status, invoice_number, invoice_date"
      )
      .eq("id", invoiceId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (invErr) {
      return NextResponse.json(
        { error: invErr.message, detail: invErr },
        { status: 403 }
      );
    }

    if (!inv) {
      return NextResponse.json(
        { error: "Invoice tidak ditemukan / forbidden" },
        { status: 404 }
      );
    }

    const invStatus = String(inv.status || "").toLowerCase();
    if (invStatus === "cancelled") {
      return NextResponse.json(
        { error: "Invoice cancelled tidak bisa dibuatkan surat jalan." },
        { status: 400 }
      );
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY belum di-set di .env.local" },
        { status: 500 }
      );
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
      .eq("org_id", orgId)
      .eq("invoice_id", invoiceId)
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json(
        { error: existingErr.message, detail: existingErr },
        { status: 400 }
      );
    }

    if (existingDn?.id) {
      return NextResponse.json(
        { id: existingDn.id, already_exists: true },
        { status: 200 }
      );
    }

    const { data: items, error: itemsErr } = await admin
      .from("invoice_items")
      .select("name, qty, sort_order, product_id, item_key, unit")
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true });

    if (itemsErr) {
      return NextResponse.json(
        { error: itemsErr.message, detail: itemsErr },
        { status: 400 }
      );
    }

    const productIds = [...new Set((items || []).map((it: any) => asText(it.product_id)).filter(Boolean))];

    let productUnitMap = new Map<string, string | null>();

    if (productIds.length > 0) {
      const { data: products, error: prodErr } = await admin
        .from("products")
        .select("id, unit")
        .in("id", productIds);

      if (prodErr) {
        return NextResponse.json(
          { error: prodErr.message, detail: prodErr },
          { status: 400 }
        );
      }

      productUnitMap = new Map(
        (products || []).map((p: any) => [String(p.id), asText(p.unit) || null])
      );
    }

    const sjDate = coerceDateOrToday(sj_date || (inv as { invoice_date?: string | null }).invoice_date);

    const insertPayload = {
      org_id: orgId,
      invoice_id: invoiceId,
      customer_name: asText((inv as any).customer_name) || "",
      customer_phone: asText((inv as any).customer_phone) || null,
      sj_date: sjDate,
      warehouse_id: inv.warehouse_id || null,
      shipping_address: inv.customer_address || "",
      driver_name: "",
      note: String(note || "").trim(),
      created_by: user.id,
    };

    const { data: createdDnRow, error: dnInsertErr } = await supabase
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
          .eq("org_id", orgId)
          .eq("invoice_id", invoiceId)
          .maybeSingle();

        if (dn2Err || !dn2?.id) {
          return NextResponse.json(
            { error: dn2Err?.message || "Duplicate but cannot fetch existing SJ" },
            { status: 400 }
          );
        }

        return NextResponse.json(
          { id: dn2.id, already_exists: true },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { error: dnInsertErr.message, detail: dnInsertErr },
        { status: 400 }
      );
    }

    if (!deliveryNoteId) {
      const { data: lastDn, error: lastDnErr } = await admin
        .from("delivery_notes")
        .select("id")
        .eq("org_id", orgId)
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastDnErr || !lastDn?.id) {
        return NextResponse.json(
          { error: lastDnErr?.message || "SJ dibuat, tapi gagal ambil id" },
          { status: 500 }
        );
      }

      deliveryNoteId = lastDn.id;
    }

    if (!deliveryNoteId) {
      return NextResponse.json(
        { error: "SJ dibuat, tapi gagal ambil id" },
        { status: 500 }
      );
    }

    const resolvedDeliveryNoteId = deliveryNoteId;

    if ((items || []).length) {
      const payload = (items || []).map((it: any, i: number) => {
        const productId = asText(it.product_id) || null;
        const unitFromInvoice = asText(it.unit) || null;
        const unitFromProduct = productId ? productUnitMap.get(productId) || null : null;

        return {
          delivery_note_id: resolvedDeliveryNoteId,
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
        await rollbackDeliveryNoteCreate(admin, resolvedDeliveryNoteId);
        return NextResponse.json(
          { error: dnItemsErr.message, detail: dnItemsErr },
          { status: 400 }
        );
      }
    }

    const finalize = await createAndFinalizeDeliveryNote({
      supabase,
      admin,
      orgId,
      userId: user.id,
      actorRole,
      deliveryNoteId: resolvedDeliveryNoteId,
      invoiceId,
    });

    if (!finalize.ok) {
      return NextResponse.json({ error: finalize.error }, { status: finalize.status });
    }

    const { data: finalizedDn } = await supabase
      .from("delivery_notes")
      .select("id, sj_number, sj_date, status")
      .eq("id", resolvedDeliveryNoteId)
      .maybeSingle();

    return NextResponse.json(
      {
        id: resolvedDeliveryNoteId,
        already_exists: false,
        sj_number: finalizedDn?.sj_number || null,
        sj_date: finalizedDn?.sj_date || sjDate,
        status: finalizedDn?.status || "posted",
        stock_moved: finalize.stock_moved,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
