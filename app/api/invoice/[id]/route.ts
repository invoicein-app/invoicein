export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { logActivity } from "@/lib/log-activity";
import { requireCanWrite } from "@/lib/subscription";
import { canEditInvoice, deriveInvoiceStatusAfterEdit, resyncInvoiceStockAfterEdit } from "@/lib/invoice-finalize";
import { upsertCustomerLatestPrices } from "@/lib/customer-item-latest-price";
import { upsertOrgManualItemsFromLines } from "@/lib/org-manual-items";
import {
  loadOrgInventoryEnabled,
  normalizeInvoiceItemInput,
  validateInvoiceItems,
} from "@/lib/invoice-items";
import { deleteInvoiceSafely } from "@/lib/invoice-delete";
import { resolveBankAccountIdForSave } from "@/lib/company-bank-accounts";
import { computeInvoiceSaveTotals } from "@/lib/invoice-totals";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { updateInvoiceBodySchema } from "@/lib/validations/invoice";

type NormItem = {
  product_id: string | null;
  name: string;
  item_key: string | null;
  qty: number;
  price: number;
  unit: string | null;
};

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asText(v: any) {
  return String(v ?? "").trim();
}

async function loadProductsForItems(
  supabase: ReturnType<typeof createServerClient>,
  orgId: string,
  items: NormItem[]
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

function pickSafeHeader(raw: Record<string, any>) {
  const h = raw || {};

  const safe: Record<string, any> = {
    customer_name: h.customer_name,
    customer_phone: h.customer_phone,
    customer_address: h.customer_address,
    note: h.note,
    invoice_date: h.invoice_date,
    due_date: h.due_date,
    discount_type: h.discount_type,
    discount_value: h.discount_value,
    tax_value: h.tax_value,
    warehouse_id: h.warehouse_id,
    bank_account_id: h.bank_account_id,
  };

  for (const k of ["customer_phone", "customer_address", "note"] as const) {
    if (safe[k] == null || String(safe[k]).trim() === "") safe[k] = "";
  }

  for (const k of ["due_date", "warehouse_id", "bank_account_id"] as const) {
    if (safe[k] != null && String(safe[k]).trim() === "") safe[k] = null;
  }

  if (safe.discount_value != null) safe.discount_value = num(safe.discount_value);
  if (safe.tax_value != null) safe.tax_value = num(safe.tax_value);

  delete safe.status;
  delete safe.payStatus;
  delete safe.remaining;
  delete safe.amount_paid;
  delete safe.total;
  delete safe.subtotal;
  delete safe.tax_amount;
  delete safe.discount_amount;

  return safe;
}

async function getSupabaseAndAuth() {
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

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return {
      supabase,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const user = userRes.user;

  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("org_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memErr) {
    return {
      supabase,
      error: NextResponse.json({ error: memErr.message }, { status: 400 }),
    };
  }

  if (!membership?.org_id) {
    return {
      supabase,
      error: NextResponse.json(
        { error: "Kamu belum punya organisasi aktif." },
        { status: 400 }
      ),
    };
  }

  return {
    supabase,
    user,
    orgId: String(membership.org_id),
    actorRole: String(membership.role || "staff"),
  };
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const auth = await getSupabaseAndAuth();
  if ((auth as any).error) return (auth as any).error;

  const { supabase, user, orgId, actorRole } = auth as any;

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const parsedBody = await parseJsonBody(req, updateInvoiceBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const { data: before, error: invErr } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (invErr) {
    return NextResponse.json({ error: invErr.message }, { status: 400 });
  }
  if (!before) {
    return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  }

  const currentStatus = String(before.status || "").toLowerCase();
  const editCheck = canEditInvoice({ status: currentStatus });
  if (!editCheck.allowed) {
    return NextResponse.json({ error: editCheck.reason || "Invoice tidak bisa diedit." }, { status: 400 });
  }

  const safeHeader = pickSafeHeader(body.header || {});

  if (!asText(safeHeader.customer_name ?? before.customer_name)) {
    return NextResponse.json(
      { error: "Customer name wajib diisi." },
      { status: 400 }
    );
  }

  const inventoryEnabled = await loadOrgInventoryEnabled(supabase, orgId);

  const normItems: NormItem[] = body.items.map((it) => normalizeInvoiceItemInput(it));

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

  const headerHasBankAccountId = Object.prototype.hasOwnProperty.call(body.header || {}, "bank_account_id");
  if (headerHasBankAccountId) {
    const bankResolved = await resolveBankAccountIdForSave({
      supabase,
      orgId,
      requestedId: safeHeader.bank_account_id,
      explicitNull: safeHeader.bank_account_id === null,
    });
    if (!bankResolved.ok) {
      return NextResponse.json({ error: bankResolved.error }, { status: 400 });
    }
    safeHeader.bank_account_id = bankResolved.bank_account_id;
  } else {
    safeHeader.bank_account_id = before.bank_account_id ?? null;
  }

  const discountType =
    String(safeHeader.discount_type ?? before.discount_type ?? "percent").toLowerCase() ===
    "amount"
      ? "amount"
      : "percent";

  const discountValue = Math.max(
    0,
    num(safeHeader.discount_value ?? before.discount_value ?? 0)
  );
  const taxValue = Math.max(
    0,
    num(safeHeader.tax_value ?? before.tax_value ?? 0)
  );

  const { subtotal, discountAmount, taxAmount, total } = computeInvoiceSaveTotals({
    items: safeItems,
    discountType,
    discountValue,
    taxPercent: taxValue,
  });
  const amountPaid = Math.max(0, Math.floor(num(before.amount_paid || 0)));
  const nextStatus = deriveInvoiceStatusAfterEdit({
    currentStatus,
    amountPaid,
    newTotal: total,
  });

  const headerPatch = {
    ...safeHeader,
    warehouse_id: inventoryEnabled ? safeHeader.warehouse_id ?? before.warehouse_id ?? null : null,
    subtotal,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    total,
    status: nextStatus,
  };

  const { data: updatedInvoice, error: upInvErr } = await supabase
    .from("invoices")
    .update(headerPatch)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (upInvErr) {
    return NextResponse.json({ error: upInvErr.message }, { status: 400 });
  }

  const { error: delErr } = await supabase
    .from("invoice_items")
    .delete()
    .eq("invoice_id", id);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 400 });
  }

  const payloadItems = safeItems.map((it, idx) => ({
    invoice_id: id,
    product_id: it.product_id,
    item_key: it.item_key,
    name: it.name,
    unit: it.unit,
    qty: Math.max(0, num(it.qty)),
    price: Math.max(0, num(it.price)),
    sort_order: idx,
  }));

  const { data: insertedItems, error: insErr } = await supabase
    .from("invoice_items")
    .insert(payloadItems)
    .select("id, product_id, item_key, price");

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  if (currentStatus !== "draft" && currentStatus !== "cancelled") {
    const stockSync = await resyncInvoiceStockAfterEdit({
      supabase,
      orgId,
      invoiceId: id,
      warehouseId:
        String(safeHeader.warehouse_id ?? before.warehouse_id ?? updatedInvoice.warehouse_id ?? "") ||
        null,
    });
    if (!stockSync.ok) {
      return NextResponse.json({ error: stockSync.error }, { status: 400 });
    }
  }

  const customerIdForPrices = String(
    safeHeader.customer_id ?? updatedInvoice.customer_id ?? before.customer_id ?? ""
  ).trim();

  if (customerIdForPrices) {
    await upsertCustomerLatestPrices({
      supabase,
      orgId,
      customerId: customerIdForPrices,
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

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "invoice.update",
    entity_type: "invoice",
    entity_id: id,
    summary: `Update invoice ${updatedInvoice.invoice_number || id}`,
    meta: {
      before,
      after: updatedInvoice,
      items_count: payloadItems.length,
    },
  });

  const remaining = Math.max(0, total - amountPaid);
  const overpayment = Math.max(0, amountPaid - total);

  return NextResponse.json({
    ok: true,
    invoice: updatedInvoice,
    amount_paid: amountPaid,
    remaining,
    overpayment,
    status: nextStatus,
  });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const auth = await getSupabaseAndAuth();
  if ((auth as any).error) return (auth as any).error;

  const { supabase, user, orgId, actorRole } = auth as any;

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const { data: before, error: invErr } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (invErr) {
    return NextResponse.json({ error: invErr.message }, { status: 400 });
  }
  if (!before) {
    return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  }

  const deleted = await deleteInvoiceSafely({
    supabase,
    orgId,
    invoice: before as Record<string, unknown>,
    actorRole,
  });

  if (!deleted.ok) {
    return NextResponse.json(
      { error: deleted.error, assessment: deleted.assessment || null },
      { status: 400 }
    );
  }

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "invoice.delete",
    entity_type: "invoice",
    entity_id: id,
    summary: `Delete invoice ${before.invoice_number || id}`,
    meta: {
      before,
    },
  });

  return NextResponse.json({
    ok: true,
    deleted_id: id,
  });
}