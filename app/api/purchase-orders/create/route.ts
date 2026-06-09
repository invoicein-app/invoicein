export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { logActivity } from "@/lib/log-activity";
import { requireCanWrite } from "@/lib/subscription";
import {
  allocateDocumentNumber,
  coerceDateOrToday,
  releaseDocumentNumberAllocation,
} from "@/lib/document-numbering";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { createPurchaseOrderBodySchema } from "@/lib/validations/purchase-order";

type POItemInput = {
  product_id: string;
  name: string;
  item_key: string;
  qty: number;
  price: number;
  unit: string | null;
};

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

export async function POST(req: Request) {
  const csAny: any = cookies() as any;
  const cookieStore: any = csAny?.then ? await csAny : csAny;

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

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ error: memErr.message }, { status: 400 });
  }

  if (!membership?.org_id) {
    return NextResponse.json(
      { error: "Kamu belum punya organisasi aktif." },
      { status: 400 }
    );
  }

  const orgId = String(membership.org_id);
  const actorRole = String((membership as any).role || "staff");

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const parsedBody = await parseJsonBody(req, createPurchaseOrderBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const {
    po_date,
    vendor_id,
    vendor_name,
    vendor_phone,
    vendor_address,
    warehouse_id,
    ship_to_name,
    ship_to_phone,
    ship_to_address,
    note,
    items,
  } = body;

  const normItems: POItemInput[] = items.map((it) => ({
    product_id: it.product_id,
    name: it.name,
    item_key: toKey(it.item_key),
    qty: it.qty,
    price: it.price,
    unit: null,
  }));

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
      asText(p.sku) || asText(p.name)
    );

    if (it.item_key !== expectedKey) {
      return NextResponse.json(
        { error: `Item baris ${i + 1}: item_key tidak cocok dengan product.` },
        { status: 400 }
      );
    }

    if (it.name !== asText(p.name)) {
      return NextResponse.json(
        { error: `Item baris ${i + 1}: nama item harus sama dengan master barang.` },
        { status: 400 }
      );
    }

    it.unit = asText(p.unit) || null;
  }

  const subtotal = normItems.reduce((a, it) => a + it.qty * it.price, 0);

  const poPayload: any = {
    org_id: orgId,
    po_date,
    vendor_id,
    vendor_name,
    vendor_phone: vendor_phone || null,
    vendor_address: vendor_address || null,
    warehouse_id,
    ship_to_name: ship_to_name || null,
    ship_to_phone: ship_to_phone || null,
    ship_to_address: ship_to_address || null,
    note: note || null,
    subtotal,
    status: "draft",
    created_by: user.id,
  };

  let docAllocation: Awaited<ReturnType<typeof allocateDocumentNumber>> | null = null;

  if (!poPayload.po_number) {
    docAllocation = await allocateDocumentNumber({
      orgId,
      docType: "purchase_order",
      documentDate: coerceDateOrToday(poPayload.po_date || po_date),
    });
    poPayload.po_number = docAllocation.documentNumber;
  }

  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .insert(poPayload)
    .select("id, po_number, status")
    .single();

  if (poErr) {
    await releaseDocumentNumberAllocation(docAllocation);
    return NextResponse.json({ error: poErr.message }, { status: 400 });
  }

  const payloadItems = normItems.map((it, idx) => ({
    purchase_order_id: po.id,
    product_id: it.product_id,
    item_key: it.item_key,
    name: it.name,
    unit: it.unit,
    qty: it.qty,
    price: it.price,
    sort_order: idx,
  }));

  const { error: itemErr } = await supabase
    .from("purchase_order_items")
    .insert(payloadItems);

  if (itemErr) {
    await supabase.from("purchase_orders").delete().eq("id", po.id);
    await releaseDocumentNumberAllocation(docAllocation);
    return NextResponse.json({ error: itemErr.message }, { status: 400 });
  }

  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      await admin
        .from("purchase_orders")
        .update({ subtotal })
        .eq("id", po.id);
    }
  } catch (e) {
    console.warn("purchase_orders subtotal sync warning:", e);
  }

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "purchase_order.create",
    entity_type: "purchase_order",
    entity_id: po.id,
    summary: `Create PO ${po.po_number || po.id}`,
    meta: {
      po_id: po.id,
      po_number: po.po_number ?? null,
      vendor_id: vendor_id || null,
      vendor_name,
      warehouse_id,
      ship_to_name: ship_to_name || null,
      subtotal,
      items_count: payloadItems.length,
      status: po.status || "draft",
    },
  });

  return NextResponse.json(
    {
      ok: true,
      id: po.id,
      po_number: po.po_number ?? null,
      subtotal,
      items_count: payloadItems.length,
    },
    { status: 200 }
  );
}