export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logActivity } from "@/lib/log-activity";
import { requireApiContext, type ApiSupabase } from "@/lib/api-context";
import {
  allocateDocumentNumber,
  coerceDateOrToday,
  releaseDocumentNumberAllocation,
} from "@/lib/document-numbering";
import { finalizeInvoice } from "@/lib/invoice-finalize";
import { upsertCustomerLatestPrices } from "@/lib/customer-item-latest-price";
import { upsertOrgManualItemsFromLines } from "@/lib/org-manual-items";
import {
  loadOrgInventoryEnabled,
  normalizeInvoiceItemInput,
  validateInvoiceItems,
} from "@/lib/invoice-items";
import { resolveBankAccountIdForSave } from "@/lib/company-bank-accounts";
import { computeInvoiceSaveTotals } from "@/lib/invoice-totals";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { createInvoiceBodySchema } from "@/lib/validations/invoice";

type Item = {
  product_id: string | null;
  name: string;
  item_key: string | null;
  qty: number;
  price: number;
  unit: string | null;
};

function clampInt(n: number, min: number, max: number) {
  const x = Math.floor(n);
  if (x < min) return min;
  if (x > max) return max;
  return x;
}

async function loadProductsForItems(
  supabase: ApiSupabase,
  orgId: string,
  items: Item[]
) {
  const productIds = [
    ...new Set(items.map((it) => it.product_id).filter((id): id is string => Boolean(id))),
  ];

  if (productIds.length === 0) {
    return new Map<string, any>();
  }

  const { data: dbProducts, error: prodErr } = await supabase
    .from("products")
    .select("id, org_id, name, sku, unit")
    .eq("org_id", orgId)
    .in("id", productIds);

  if (prodErr) {
    throw new Error(prodErr.message);
  }

  return new Map<string, any>(
    (dbProducts || []).map((p: any) => [String(p.id), p] as [string, any])
  );
}

export async function POST(req: Request) {
  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;

  const { supabase, user, orgId, actorRole } = auth.ctx;

  const parsedBody = await parseJsonBody(req, createInvoiceBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const {
    invoice_date,
    due_date,
    quotation_id,
    customer_id,
    customer_name,
    customer_phone,
    customer_address,
    note,
    discount_type,
    discount_value,
    tax_value,
    warehouse_id,
    bank_account_id,
    items,
  } = body;

  const dt = discount_type ?? "percent";

  let dVal = 0;
  if (dt === "percent") dVal = clampInt(discount_value, 0, 100);
  else dVal = Math.max(0, Math.floor(discount_value));

  const tPct = tax_value;

  const inventoryEnabled = await loadOrgInventoryEnabled(supabase, orgId);

  const normItems: Item[] = items.map((it) => normalizeInvoiceItemInput(it));

  let productsById = new Map<string, any>();
  try {
    productsById = await loadProductsForItems(supabase, orgId, normItems);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal memuat product." }, { status: 400 });
  }

  const validated = validateInvoiceItems({
    items: normItems,
    inventoryEnabled,
    productsById,
  });

  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const safeItems = validated.items;

  const bankResolved = await resolveBankAccountIdForSave({
    supabase,
    orgId,
    requestedId: bank_account_id,
    explicitNull: bank_account_id === null,
  });
  if (!bankResolved.ok) {
    return NextResponse.json({ error: bankResolved.error }, { status: 400 });
  }

  const { subtotal, discountAmount, taxAmount, total } = computeInvoiceSaveTotals({
    items: safeItems,
    discountType: dt,
    discountValue: dVal,
    taxPercent: tPct,
  });

  let quotationNumber: string | null = null;
  if (quotation_id) {
    const { data: qRow, error: qErr } = await supabase
      .from("quotations")
      .select("quotation_number")
      .eq("id", quotation_id)
      .maybeSingle();

    if (!qErr && qRow?.quotation_number) {
      quotationNumber = String(qRow.quotation_number);
    }
  }

  const invoicePayload: any = {
    org_id: orgId,
    invoice_date,
    due_date,

    quotation_id: quotation_id || null,
    quotation_number: quotationNumber,

    customer_id: customer_id || null,
    customer_name,
    customer_phone,
    customer_address,
    note,

    discount_type: dt,
    discount_value: dVal,
    tax_value: tPct,
    warehouse_id: inventoryEnabled ? warehouse_id || null : null,
    bank_account_id: bankResolved.bank_account_id,

    subtotal,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    total,

    created_by: user.id,
    amount_paid: 0,
    status: "draft",
  };

  let docAllocation: Awaited<ReturnType<typeof allocateDocumentNumber>> | null = null;

  if (!invoicePayload.invoice_number) {
    docAllocation = await allocateDocumentNumber({
      orgId,
      docType: "invoice",
      documentDate: coerceDateOrToday(invoicePayload.invoice_date || invoice_date),
    });
    invoicePayload.invoice_number = docAllocation.documentNumber;
  }

  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .insert(invoicePayload)
    .select("id, invoice_number, quotation_id, quotation_number")
    .single();

  if (invErr) {
    await releaseDocumentNumberAllocation(docAllocation);
    return NextResponse.json({ error: invErr.message }, { status: 400 });
  }

  const payloadItems = safeItems.map((it, idx) => ({
    invoice_id: inv.id,
    product_id: it.product_id,
    item_key: it.item_key,
    name: it.name,
    unit: it.unit,
    qty: it.qty,
    price: it.price,
    sort_order: idx,
  }));

  const { data: insertedItems, error: itemErr } = await supabase
    .from("invoice_items")
    .insert(payloadItems)
    .select("id, product_id, item_key, price");

  if (itemErr) {
    await supabase.from("invoices").delete().eq("id", inv.id);
    await releaseDocumentNumberAllocation(docAllocation);
    return NextResponse.json({ error: itemErr.message }, { status: 400 });
  }

  if (quotation_id) {
    try {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );

      const { error: linkErr } = await admin
        .from("quotations")
        .update({
          invoice_id: inv.id,
          is_locked: true,
          status: "accepted",
        })
        .eq("id", quotation_id);

      if (linkErr) {
        console.warn("link quotation -> invoice failed:", linkErr.message);
      }
    } catch (e) {
      console.warn("link quotation -> invoice exception:", e);
    }
  }

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "invoice.create",
    entity_type: "invoice",
    entity_id: inv.id,
    summary: `Create invoice ${inv.invoice_number || inv.id}`,
    meta: {
      invoice_id: inv.id,
      invoice_number: inv.invoice_number ?? null,
      customer_name: customer_name || null,
      quotation_id: quotation_id || null,
      quotation_number: quotationNumber,
      warehouse_id: warehouse_id || null,
      subtotal,
      discount_amount: discountAmount,
      tax_percent: tPct,
      tax_amount: taxAmount,
      total,
      due_date,
      items_count: payloadItems.length,
      status: "draft",
    },
  });

  const finalized = await finalizeInvoice({
    supabase,
    orgId,
    invoiceId: inv.id,
    userId: user.id,
    actorRole,
    activityAction: "invoice.create_finalize",
  });

  if (!finalized.ok) {
    await supabase.from("invoice_items").delete().eq("invoice_id", inv.id);
    await supabase.from("invoices").delete().eq("id", inv.id);
    await releaseDocumentNumberAllocation(docAllocation);
    return NextResponse.json({ error: finalized.error }, { status: 400 });
  }

  if (customer_id) {
    await upsertCustomerLatestPrices({
      supabase,
      orgId,
      customerId: customer_id,
      lines: (insertedItems || []).map((row: any) => ({
        product_id: row.product_id,
        item_key: row.item_key,
        price: row.price,
        invoice_item_id: row.id,
      })),
    });
  }

  await upsertOrgManualItemsFromLines({
    supabase,
    orgId,
    lines: safeItems.map((it) => ({
      product_id: it.product_id,
      name: it.name,
      item_key: it.item_key,
    })),
  });

  return NextResponse.json(
    {
      id: inv.id,
      invoice_number: inv.invoice_number ?? null,
      quotation_id: inv.quotation_id ?? null,
      quotation_number: inv.quotation_number ?? quotationNumber ?? null,
      status: "sent",
      stock_moved: finalized.stock_moved,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total,
    },
    { status: 200 }
  );
}