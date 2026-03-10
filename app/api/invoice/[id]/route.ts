export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { logActivity } from "@/lib/log-activity";
import { requireCanWrite } from "@/lib/subscription";

type UpdateInvoiceBody = {
  header?: Record<string, any>;
  items?: Array<{
    product_id: string;
    name: string;
    item_key: string;
    qty: number;
    price: number;
    sort_order?: number;
  }>;
};

type NormItem = {
  product_id: string;
  name: string;
  item_key: string;
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

function toKey(raw: string) {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "";
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
    discount_value: h.discount_value,
    tax_value: h.tax_value,
    warehouse_id: h.warehouse_id,
  };

  for (const k of [
    "customer_phone",
    "customer_address",
    "note",
    "due_date",
    "warehouse_id",
  ] as const) {
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

  const body = (await req.json().catch(() => null)) as UpdateInvoiceBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

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
  if (currentStatus !== "draft") {
    return NextResponse.json(
      { error: "Hanya invoice draft yang boleh diedit." },
      { status: 400 }
    );
  }

  const safeHeader = pickSafeHeader(body.header || {});

  if (!asText(safeHeader.customer_name ?? before.customer_name)) {
    return NextResponse.json(
      { error: "Customer name wajib diisi." },
      { status: 400 }
    );
  }

  const itemsRaw = Array.isArray(body.items) ? body.items : [];
  if (itemsRaw.length === 0) {
    return NextResponse.json({ error: "Minimal 1 item." }, { status: 400 });
  }

  const normItems: NormItem[] = itemsRaw.map((it: any) => ({
    product_id: asText(it.product_id),
    name: asText(it.name),
    item_key: toKey(asText(it.item_key)),
    qty: Math.max(0, num(it.qty)),
    price: Math.max(0, num(it.price)),
    unit: null,
  }));

  const badIndex = normItems.findIndex(
    (it) =>
      !it.product_id ||
      !it.name ||
      !it.item_key ||
      !Number.isFinite(it.qty) ||
      it.qty <= 0
  );

  if (badIndex >= 0) {
    return NextResponse.json(
      { error: `Item baris ${badIndex + 1} wajib pilih dari master barang.` },
      { status: 400 }
    );
  }

  const productIds = [...new Set(normItems.map((it) => it.product_id))];

  const { data: dbProducts, error: prodErr } = await supabase
    .from("products")
    .select("id, org_id, name, sku, unit")
    .eq("org_id", orgId)
    .in("id", productIds);

  if (prodErr) {
    return NextResponse.json({ error: prodErr.message }, { status: 400 });
  }

  const productMap = new Map(
    (dbProducts || []).map((p: any) => [String(p.id), p])
  );

  for (let i = 0; i < normItems.length; i++) {
    const it = normItems[i];
    const p: any = productMap.get(it.product_id);

    if (!p) {
      return NextResponse.json(
        { error: `Item baris ${i + 1}: product tidak ditemukan.` },
        { status: 400 }
      );
    }

    const expectedKey = toKey(
      String(p.sku || "").trim() || String(p.name || "").trim()
    );

    if (it.item_key !== expectedKey) {
      return NextResponse.json(
        { error: `Item baris ${i + 1}: item_key tidak cocok dengan product.` },
        { status: 400 }
      );
    }

    if (it.name !== String(p.name || "").trim()) {
      return NextResponse.json(
        {
          error: `Item baris ${i + 1}: nama item harus sama dengan master barang.`,
        },
        { status: 400 }
      );
    }

    it.unit = asText(p.unit) || null;
  }

  const subtotal = normItems.reduce(
    (a, it) => a + Math.max(0, num(it.qty)) * Math.max(0, num(it.price)),
    0
  );

  const discountValue = Math.max(
    0,
    num(safeHeader.discount_value ?? before.discount_value ?? 0)
  );
  const taxValue = Math.max(
    0,
    num(safeHeader.tax_value ?? before.tax_value ?? 0)
  );

  const discountAmount = subtotal * (discountValue / 100);
  const afterDisc = Math.max(0, subtotal - discountAmount);
  const taxAmount = afterDisc * (taxValue / 100);
  const total = Math.max(0, afterDisc + taxAmount);

  const headerPatch = {
    ...safeHeader,
    subtotal,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    total,
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

  const payloadItems = normItems.map((it, idx) => ({
    invoice_id: id,
    product_id: it.product_id,
    item_key: it.item_key,
    name: it.name,
    unit: it.unit,
    qty: Math.max(0, num(it.qty)),
    price: Math.max(0, num(it.price)),
    sort_order: idx,
  }));

  const { error: insErr } = await supabase
    .from("invoice_items")
    .insert(payloadItems);

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

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

  return NextResponse.json({
    ok: true,
    invoice: updatedInvoice,
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

  const currentStatus = String(before.status || "").toLowerCase();
  if (currentStatus !== "draft") {
    return NextResponse.json(
      { error: "Hanya invoice draft yang boleh dihapus." },
      { status: 400 }
    );
  }

  if (before.quotation_id) {
    return NextResponse.json(
      { error: "Invoice yang berasal dari quotation tidak boleh dihapus." },
      { status: 400 }
    );
  }

  const { error: delItemsErr } = await supabase
    .from("invoice_items")
    .delete()
    .eq("invoice_id", id);

  if (delItemsErr) {
    return NextResponse.json({ error: delItemsErr.message }, { status: 400 });
  }

  const { error: delInvErr } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (delInvErr) {
    return NextResponse.json({ error: delInvErr.message }, { status: 400 });
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