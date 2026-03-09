export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { logActivity } from "@/lib/log-activity";

type POItemInput = {
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

function safeDateOrNull(v: any) {
  const s = String(v || "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
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

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

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
  } = body as any;

  if (!asText(vendor_name)) {
    return NextResponse.json({ error: "Nama vendor wajib." }, { status: 400 });
  }

  if (!warehouse_id) {
    return NextResponse.json({ error: "Gudang tujuan wajib dipilih." }, { status: 400 });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Minimal 1 item." }, { status: 400 });
  }

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

  const normItems: POItemInput[] = (items as any[]).map((it: any) => ({
    product_id: asText(it?.product_id),
    name: asText(it?.name),
    item_key: toKey(asText(it?.item_key)),
    qty: Math.max(0, Math.floor(num(it?.qty))),
    price: Math.max(0, Math.floor(num(it?.price))),
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
    po_date: safeDateOrNull(po_date),
    vendor_id: vendor_id || null,
    vendor_name: asText(vendor_name),
    vendor_phone: asText(vendor_phone) || null,
    vendor_address: asText(vendor_address) || null,

    warehouse_id: warehouse_id || null,
    ship_to_name: asText(ship_to_name) || null,
    ship_to_phone: asText(ship_to_phone) || null,
    ship_to_address: asText(ship_to_address) || null,

    note: asText(note) || null,
    subtotal,
    status: "draft",
    created_by: user.id,
  };

  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .insert(poPayload)
    .select("id, po_number, status")
    .single();

  if (poErr) {
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
      vendor_name: asText(vendor_name),
      warehouse_id: warehouse_id || null,
      ship_to_name: asText(ship_to_name) || null,
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