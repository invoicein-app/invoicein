export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import crypto from "crypto";
import { requireCanWrite } from "@/lib/subscription";

function isUuid(v: any) {
  const s = String(v || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isAdminRole(role: string) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "owner" || r === "super_admin";
}

function toKey(raw: any) {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "";
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const warehouseId = String(id || "").trim();

  if (!isUuid(warehouseId)) {
    return NextResponse.json({ error: "Invalid warehouse id" }, { status: 400 });
  }

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

  const inputProductId = String(body.product_id || "").trim();
  const qtyDelta = Math.floor(num(body.qty_delta));
  const note = body.note == null ? null : String(body.note || "").trim();

  if (!isUuid(inputProductId)) {
    return NextResponse.json(
      { error: "product_id wajib dipilih dari master barang." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(qtyDelta) || qtyDelta === 0) {
    return NextResponse.json({ error: "qty_delta harus != 0" }, { status: 400 });
  }

  const { data: mem, error: memErr } = await supabase
    .from("memberships")
    .select("org_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 400 });
  }

  const orgId = String((mem as any)?.org_id || "");
  const role = String((mem as any)?.role || "");

  if (!orgId) {
    return NextResponse.json({ error: "Org tidak ditemukan" }, { status: 400 });
  }

  if (!isAdminRole(role)) {
    return NextResponse.json(
      { error: "Forbidden (admin/owner only)" },
      { status: 403 }
    );
  }

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const { data: wh, error: whErr } = await supabase
    .from("warehouses")
    .select("id")
    .eq("id", warehouseId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (whErr) {
    return NextResponse.json({ error: whErr.message }, { status: 400 });
  }
  if (!wh) {
    return NextResponse.json(
      { error: "Gudang tidak ditemukan / beda org" },
      { status: 404 }
    );
  }

  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("id, org_id, name, sku")
    .eq("id", inputProductId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (prodErr) {
    return NextResponse.json({ error: prodErr.message }, { status: 400 });
  }
  if (!product) {
    return NextResponse.json(
      { error: "Barang tidak ditemukan. Pilih dari master products dulu." },
      { status: 400 }
    );
  }

  const productId = String(product.id);
  const itemName = String(product.name || "").trim();
  const itemKey = toKey(String(product.sku || "").trim() || itemName);

  const { data: bal, error: balErr } = await supabase
    .from("inventory_balances")
    .select("on_hand")
    .eq("org_id", orgId)
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId)
    .maybeSingle();

  if (balErr) {
    return NextResponse.json({ error: balErr.message }, { status: 400 });
  }

  const currentOnHand =
    bal && bal.on_hand != null ? Math.floor(num((bal as any).on_hand)) : 0;

  const nextOnHand = currentOnHand + qtyDelta;

  const { error: upErr } = await supabase
    .from("inventory_balances")
    .upsert(
      {
        org_id: orgId,
        warehouse_id: warehouseId,
        product_id: productId,
        item_key: itemKey,
        item_name: itemName,
        on_hand: nextOnHand,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,warehouse_id,item_key" }
    );

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  const adjId = crypto.randomUUID();
  const adjLineId = crypto.randomUUID();
  const qtyIn = qtyDelta > 0 ? qtyDelta : 0;
  const qtyOut = qtyDelta < 0 ? Math.abs(qtyDelta) : 0;

  const { data: led, error: ledErr } = await supabase
    .from("stock_ledger")
    .insert({
      org_id: orgId,
      warehouse_id: warehouseId,
      product_id: productId,
      ref_type: "ADJUSTMENT",
      ref_id: adjId,
      ref_line_id: adjLineId,
      product_name: itemName,
      qty_in: qtyIn,
      qty_out: qtyOut,
    })
    .select("id, created_at")
    .single();

  if (ledErr) {
    return NextResponse.json({ error: ledErr.message }, { status: 400 });
  }

  return NextResponse.json(
    {
      ok: true,
      warehouse_id: warehouseId,
      product_id: productId,
      item_key: itemKey,
      item_name: itemName,
      prev_on_hand: currentOnHand,
      next_on_hand: nextOnHand,
      ledger_id: (led as any)?.id || null,
      ref_id: adjId,
      ref_line_id: adjLineId,
      created_at: (led as any)?.created_at || null,
      note: note || null,
    },
    { status: 200 }
  );
}