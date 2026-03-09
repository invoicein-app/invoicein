export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { logActivity } from "@/lib/log-activity";

function isUuid(v: any) {
  const s = String(v || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const deliveryNoteId = String(id || "").trim();

  if (!isUuid(deliveryNoteId)) {
    return NextResponse.json({ error: "Invalid delivery note id" }, { status: 400 });
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
  if (!mem?.org_id) {
    return NextResponse.json({ error: "Org tidak ditemukan" }, { status: 400 });
  }

  const orgId = String((mem as any).org_id);
  const actorRole = String((mem as any).role || "staff");

  const { data: dn, error: dnErr } = await supabase
    .from("delivery_notes")
    .select("id, org_id, invoice_id, sj_number, status, warehouse_id")
    .eq("id", deliveryNoteId)
    .maybeSingle();

  if (dnErr) {
    return NextResponse.json({ error: dnErr.message }, { status: 400 });
  }
  if (!dn) {
    return NextResponse.json({ error: "Surat jalan tidak ditemukan." }, { status: 404 });
  }
  if (String((dn as any).org_id || "") !== orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dnStatus = String((dn as any).status || "draft").toLowerCase();

  if (dnStatus === "posted") {
    return NextResponse.json({ error: "Surat jalan sudah dipost." }, { status: 400 });
  }
  if (dnStatus === "cancelled") {
    return NextResponse.json({ error: "Surat jalan cancelled tidak bisa dipost." }, { status: 400 });
  }

  const { data: settings, error: settingsErr } = await supabase
    .from("org_settings")
    .select("allow_negative_stock, stock_issue_trigger")
    .eq("org_id", orgId)
    .maybeSingle();

  if (settingsErr) {
    return NextResponse.json({ error: settingsErr.message }, { status: 400 });
  }

  const allowNegativeStock =
    typeof settings?.allow_negative_stock === "boolean"
      ? !!settings.allow_negative_stock
      : true;

  const stockIssueTrigger = String(
    settings?.stock_issue_trigger || "invoice_sent"
  );

  const warehouseId = String((dn as any).warehouse_id || "").trim();

  const { data: items, error: itemsErr } = await supabase
    .from("delivery_note_items")
    .select("id, name, qty, product_id, item_key, sort_order")
    .eq("delivery_note_id", deliveryNoteId)
    .order("sort_order", { ascending: true });

  if (itemsErr) {
    return NextResponse.json({ error: itemsErr.message }, { status: 400 });
  }
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Surat jalan tidak punya item." }, { status: 400 });
  }

  // Kalau trigger stok bukan delivery_note_posted => cuma post dokumen
  if (stockIssueTrigger !== "delivery_note_posted") {
    const { error: upErr } = await supabase
      .from("delivery_notes")
      .update({
        status: "posted",
        posted_at: new Date().toISOString(),
      })
      .eq("id", deliveryNoteId)
      .eq("org_id", orgId);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    await logActivity({
      org_id: orgId,
      actor_user_id: user.id,
      actor_role: actorRole,
      action: "delivery_note.post",
      entity_type: "delivery_note",
      entity_id: deliveryNoteId,
      summary: `Post delivery note ${String((dn as any).sj_number || deliveryNoteId)}`,
      meta: {
        delivery_note_id: deliveryNoteId,
        sj_number: (dn as any).sj_number || null,
        stock_issue_trigger: stockIssueTrigger,
        stock_movement: "skipped",
        reason: "trigger is not delivery_note_posted",
      },
    });

    return NextResponse.json(
      {
        ok: true,
        status: "posted",
        stock_moved: false,
        reason: "stock_issue_trigger is not delivery_note_posted",
      },
      { status: 200 }
    );
  }

  // trigger stok = delivery_note_posted => warehouse wajib ada
  if (!warehouseId) {
    return NextResponse.json(
      { error: "warehouse_id pada surat jalan wajib diisi untuk trigger stok delivery_note_posted." },
      { status: 400 }
    );
  }

  const { data: existingLedger, error: existingLedgerErr } = await supabase
    .from("stock_ledger")
    .select("id")
    .eq("org_id", orgId)
    .eq("warehouse_id", warehouseId)
    .eq("ref_type", "DELIVERY_NOTE")
    .eq("ref_id", deliveryNoteId)
    .limit(1)
    .maybeSingle();

  if (existingLedgerErr) {
    return NextResponse.json({ error: existingLedgerErr.message }, { status: 400 });
  }

  if (existingLedger) {
    return NextResponse.json(
      { error: "Stock movement surat jalan ini sudah pernah diposting." },
      { status: 400 }
    );
  }

  for (let i = 0; i < items.length; i++) {
    const it: any = items[i];
    if (!String(it.product_id || "").trim()) {
      return NextResponse.json(
        { error: `Item baris ${i + 1} belum linked ke product.` },
        { status: 400 }
      );
    }
    if (!String(it.item_key || "").trim()) {
      return NextResponse.json(
        { error: `Item baris ${i + 1} belum punya item_key.` },
        { status: 400 }
      );
    }
    if (Math.max(0, Math.floor(num(it.qty))) <= 0) {
      return NextResponse.json(
        { error: `Qty item baris ${i + 1} harus > 0.` },
        { status: 400 }
      );
    }
  }

  // pre-check stok
  for (let i = 0; i < items.length; i++) {
    const it: any = items[i];
    const qty = Math.max(0, Math.floor(num(it.qty)));
    const productId = String(it.product_id || "").trim();

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

    const nextOnHand = currentOnHand - qty;

    if (!allowNegativeStock && nextOnHand < 0) {
      return NextResponse.json(
        {
          error: `Stok tidak cukup untuk item "${String(it.name || it.item_key)}". Stok saat ini ${currentOnHand}, butuh ${qty}.`,
        },
        { status: 400 }
      );
    }
  }

  // apply stok
  for (let i = 0; i < items.length; i++) {
    const it: any = items[i];

    const itemId = String(it.id || "").trim();
    const productId = String(it.product_id || "").trim();
    const itemKey = String(it.item_key || "").trim();
    const itemName = String(it.name || "").trim();
    const qty = Math.max(0, Math.floor(num(it.qty)));

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

    const nextOnHand = currentOnHand - qty;

    const { error: upBalErr } = await supabase
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

    if (upBalErr) {
      return NextResponse.json({ error: upBalErr.message }, { status: 400 });
    }

    const { error: ledErr } = await supabase
      .from("stock_ledger")
      .insert({
        org_id: orgId,
        warehouse_id: warehouseId,
        product_id: productId,
        ref_type: "DELIVERY_NOTE",
        ref_id: deliveryNoteId,
        ref_line_id: itemId,
        product_name: itemName,
        qty_in: 0,
        qty_out: qty,
      });

    if (ledErr) {
      return NextResponse.json({ error: ledErr.message }, { status: 400 });
    }
  }

  const { error: postErr } = await supabase
    .from("delivery_notes")
    .update({
      status: "posted",
      posted_at: new Date().toISOString(),
    })
    .eq("id", deliveryNoteId)
    .eq("org_id", orgId);

  if (postErr) {
    return NextResponse.json({ error: postErr.message }, { status: 400 });
  }

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "delivery_note.post",
    entity_type: "delivery_note",
    entity_id: deliveryNoteId,
    summary: `Post delivery note ${String((dn as any).sj_number || deliveryNoteId)}`,
    meta: {
      delivery_note_id: deliveryNoteId,
      sj_number: (dn as any).sj_number || null,
      warehouse_id: warehouseId,
      stock_issue_trigger: stockIssueTrigger,
      stock_moved: true,
      items_count: items.length,
      allow_negative_stock: allowNegativeStock,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      status: "posted",
      stock_moved: true,
      warehouse_id: warehouseId,
      items_count: items.length,
    },
    { status: 200 }
  );
}