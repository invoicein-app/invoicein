export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireApiContext, asText } from "@/lib/api-context";
import { coerceDateOrToday } from "@/lib/document-numbering";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { createDeliveryNoteFromInvoiceBodySchema } from "@/lib/validations/delivery-note";
import { createAndFinalizeDeliveryNote, rollbackDeliveryNoteCreate } from "@/lib/delivery-note-post";
import {
  buildDeliveryNoteItemPayload,
  countDeliveryNoteItems,
  findDeliveryNoteForInvoice,
  findDeliveryNoteForInvoiceWithRetry,
  loadInvoiceItemsForDeliveryNote,
  type InvoiceItemForDn,
} from "@/lib/delivery-note-from-invoice";
import { normalizeDeliveryNoteStatus } from "@/lib/delivery-note-status";

function isDuplicateKeyError(err: unknown) {
  return String((err as { code?: string })?.code || "") === "23505";
}

async function completeDeliveryNoteFromInvoice(args: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  orgId: string;
  userId: string;
  actorRole: string;
  deliveryNoteId: string;
  invoiceId: string;
  items: InvoiceItemForDn[];
}) {
  const { supabase, admin, orgId, userId, actorRole, deliveryNoteId, invoiceId, items } = args;

  const itemCount = await countDeliveryNoteItems(admin, deliveryNoteId);
  if (itemCount === 0 && items.length > 0) {
    const payload = await buildDeliveryNoteItemPayload(admin, deliveryNoteId, items);
    const { error: dnItemsErr } = await admin.from("delivery_note_items").insert(payload);
    if (dnItemsErr) {
      return { ok: false as const, error: dnItemsErr.message, status: 400 };
    }
  }

  const { data: dnRow, error: dnErr } = await admin
    .from("delivery_notes")
    .select("status")
    .eq("id", deliveryNoteId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (dnErr) {
    return { ok: false as const, error: dnErr.message, status: 400 };
  }

  const status = normalizeDeliveryNoteStatus(dnRow?.status);
  if (status !== "posted") {
    const finalize = await createAndFinalizeDeliveryNote({
      supabase,
      admin,
      orgId,
      userId,
      actorRole,
      deliveryNoteId,
      invoiceId,
    });

    if (!finalize.ok) {
      return { ok: false as const, error: finalize.error, status: finalize.status };
    }
  }

  return { ok: true as const };
}

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
      return NextResponse.json({ error: invErr.message, detail: invErr }, { status: 403 });
    }

    if (!inv) {
      return NextResponse.json({ error: "Invoice tidak ditemukan / forbidden" }, { status: 404 });
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
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const itemsLoaded = await loadInvoiceItemsForDeliveryNote(admin, invoiceId);
    if (!itemsLoaded.ok) {
      return NextResponse.json({ error: itemsLoaded.error }, { status: 400 });
    }

    const existing = await findDeliveryNoteForInvoice(admin, orgId, invoiceId);
    if (!existing.ok) {
      return NextResponse.json({ error: existing.error }, { status: 400 });
    }

    if (existing.dn?.id) {
      const dnStatus = normalizeDeliveryNoteStatus(existing.dn.status);
      if (dnStatus === "cancelled") {
        return NextResponse.json(
          { error: "Surat jalan untuk invoice ini sudah dibatalkan. Hubungi admin jika perlu SJ baru." },
          { status: 400 }
        );
      }

      const completed = await completeDeliveryNoteFromInvoice({
        supabase,
        admin,
        orgId,
        userId: user.id,
        actorRole,
        deliveryNoteId: existing.dn.id,
        invoiceId,
        items: itemsLoaded.items,
      });

      if (!completed.ok) {
        return NextResponse.json({ error: completed.error }, { status: completed.status });
      }

      return NextResponse.json({ id: existing.dn.id, already_exists: true }, { status: 200 });
    }

    const sjDate = coerceDateOrToday(sj_date || (inv as { invoice_date?: string | null }).invoice_date);

    const insertPayload = {
      org_id: orgId,
      invoice_id: invoiceId,
      customer_name: asText((inv as { customer_name?: string | null }).customer_name) || "",
      customer_phone: asText((inv as { customer_phone?: string | null }).customer_phone) || null,
      sj_date: sjDate,
      warehouse_id: inv.warehouse_id || null,
      shipping_address: inv.customer_address || "",
      driver_name: "",
      note: String(note || "").trim(),
      created_by: user.id,
    };

    const { data: createdDnRow, error: dnInsertErr } = await admin
      .from("delivery_notes")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();

    let deliveryNoteId: string | null = createdDnRow?.id ? String(createdDnRow.id) : null;

    if (dnInsertErr) {
      if (isDuplicateKeyError(dnInsertErr)) {
        const raced = await findDeliveryNoteForInvoiceWithRetry(admin, orgId, invoiceId);
        if (!raced.ok) {
          return NextResponse.json({ error: raced.error }, { status: 400 });
        }

        if (raced.dn?.id) {
          const completed = await completeDeliveryNoteFromInvoice({
            supabase,
            admin,
            orgId,
            userId: user.id,
            actorRole,
            deliveryNoteId: raced.dn.id,
            invoiceId,
            items: itemsLoaded.items,
          });

          if (!completed.ok) {
            return NextResponse.json({ error: completed.error }, { status: completed.status });
          }

          return NextResponse.json({ id: raced.dn.id, already_exists: true }, { status: 200 });
        }

        const detail = String((dnInsertErr as { message?: string }).message || "").trim();
        return NextResponse.json(
          {
            error:
              "Surat jalan untuk invoice ini sudah dibuat. Muat ulang halaman invoice lalu buka SJ yang ada." +
              (detail ? ` (${detail})` : ""),
          },
          { status: 409 }
        );
      }

      return NextResponse.json({ error: dnInsertErr.message, detail: dnInsertErr }, { status: 400 });
    }

    if (!deliveryNoteId) {
      const raced = await findDeliveryNoteForInvoiceWithRetry(admin, orgId, invoiceId);
      if (!raced.ok) {
        return NextResponse.json({ error: raced.error }, { status: 500 });
      }
      if (!raced.dn?.id) {
        return NextResponse.json({ error: "SJ dibuat, tapi gagal ambil id" }, { status: 500 });
      }
      deliveryNoteId = raced.dn.id;
    }

    if (itemsLoaded.items.length > 0) {
      const payload = await buildDeliveryNoteItemPayload(admin, deliveryNoteId, itemsLoaded.items);
      const { error: dnItemsErr } = await admin.from("delivery_note_items").insert(payload);

      if (dnItemsErr) {
        await rollbackDeliveryNoteCreate(admin, deliveryNoteId);
        return NextResponse.json({ error: dnItemsErr.message, detail: dnItemsErr }, { status: 400 });
      }
    }

    const finalize = await createAndFinalizeDeliveryNote({
      supabase,
      admin,
      orgId,
      userId: user.id,
      actorRole,
      deliveryNoteId,
      invoiceId,
    });

    if (!finalize.ok) {
      return NextResponse.json({ error: finalize.error }, { status: finalize.status });
    }

    const { data: finalizedDn } = await admin
      .from("delivery_notes")
      .select("id, sj_number, sj_date, status")
      .eq("id", deliveryNoteId)
      .maybeSingle();

    return NextResponse.json(
      {
        id: deliveryNoteId,
        already_exists: false,
        sj_number: finalizedDn?.sj_number || null,
        sj_date: finalizedDn?.sj_date || sjDate,
        status: finalizedDn?.status || "posted",
        stock_moved: finalize.stock_moved,
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
