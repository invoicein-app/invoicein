export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { logActivity } from "@/lib/log-activity";
import { requireCanWrite } from "@/lib/subscription";

function isUuid(v: any) {
  const s = String(v || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}
function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const invoiceId = String(id || "").trim();

  if (!isUuid(invoiceId)) {
    return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
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

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .select("id, org_id, status, warehouse_id, invoice_number, customer_name")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invErr) {
    return NextResponse.json({ error: invErr.message }, { status: 400 });
  }
  if (!inv) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (String((inv as any).org_id || "") !== orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const currentStatus = String((inv as any).status || "").toLowerCase();
  if (currentStatus === "sent" || currentStatus === "paid") {
    return NextResponse.json(
      { error: "Invoice sudah pernah dikirim / diposting." },
      { status: 400 }
    );
  }
  if (currentStatus === "cancelled") {
    return NextResponse.json(
      { error: "Invoice cancelled tidak bisa dikirim." },
      { status: 400 }
    );
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

  const { data: items, error: itemErr } = await supabase
    .from("invoice_items")
    .select("id, product_id, item_key, name, qty, price")
    .eq("invoice_id", invoiceId)
    .order("sort_order", { ascending: true });

  if (itemErr) {
    return NextResponse.json({ error: itemErr.message }, { status: 400 });
  }
  if (!items || items.length === 0) {
    return NextResponse.json(
      { error: "Invoice tidak punya item." },
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

  // =========================================================
  // CASE 1:
  // trigger stok bukan invoice_sent
  // -> cuma update status invoice jadi sent
  // =========================================================
  if (stockIssueTrigger !== "invoice_sent") {
    const { error: upErr } = await supabase
      .from("invoices")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", invoiceId)
      .eq("org_id", orgId);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    await logActivity({
      org_id: orgId,
      actor_user_id: user.id,
      actor_role: actorRole,
      action: "invoice.sent",
      entity_type: "invoice",
      entity_id: invoiceId,
      summary: `Send invoice ${String((inv as any).invoice_number || invoiceId)}`,
      meta: {
        invoice_id: invoiceId,
        invoice_number: (inv as any).invoice_number || null,
        customer_name: (inv as any).customer_name || null,
        stock_issue_trigger: stockIssueTrigger,
        stock_movement: "skipped",
        reason: "trigger is not invoice_sent",
      },
    });

    return NextResponse.json(
      {
        ok: true,
        status: "sent",
        stock_moved: false,
        reason: "stock_issue_trigger is not invoice_sent",
      },
      { status: 200 }
    );
  }

  // =========================================================
  // CASE 2:
  // trigger stok = invoice_sent
  // kalau warehouse kosong -> skip stok, tetap sent
  // =========================================================
  const warehouseId = String((inv as any).warehouse_id || "").trim();

  if (!warehouseId) {
    const { error: upErr } = await supabase
      .from("invoices")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", invoiceId)
      .eq("org_id", orgId);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    await logActivity({
      org_id: orgId,
      actor_user_id: user.id,
      actor_role: actorRole,
      action: "invoice.sent",
      entity_type: "invoice",
      entity_id: invoiceId,
      summary: `Send invoice ${String((inv as any).invoice_number || invoiceId)}`,
      meta: {
        invoice_id: invoiceId,
        invoice_number: (inv as any).invoice_number || null,
        customer_name: (inv as any).customer_name || null,
        stock_issue_trigger: stockIssueTrigger,
        stock_movement: "skipped",
        reason: "warehouse_id is null",
      },
    });

    return NextResponse.json(
      {
        ok: true,
        status: "sent",
        stock_moved: false,
        reason: "warehouse_id empty",
      },
      { status: 200 }
    );
  }

  // =========================================================
  // CASE 3:
  // trigger stok = invoice_sent + warehouse ada
  // -> cek double post dulu dari stock_ledger
  // =========================================================
  const { data: existingLedger, error: existingLedgerErr } = await supabase
    .from("stock_ledger")
    .select("id")
    .eq("org_id", orgId)
    .eq("warehouse_id", warehouseId)
    .eq("ref_type", "INVOICE")
    .eq("ref_id", invoiceId)
    .limit(1)
    .maybeSingle();

  if (existingLedgerErr) {
    return NextResponse.json({ error: existingLedgerErr.message }, { status: 400 });
  }

  if (existingLedger) {
    return NextResponse.json(
      { error: "Stock movement invoice ini sudah pernah diposting." },
      { status: 400 }
    );
  }

  // =========================================================
  // PRE-CHECK stok
  // =========================================================
  for (let i = 0; i < items.length; i++) {
    const it: any = items[i];

    const qty = Math.max(0, Math.floor(num(it.qty)));
    const productId = String(it.product_id || "").trim();
    const itemKey = String(it.item_key || "").trim();

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
      bal && bal.on_hand != null
        ? Math.floor(num((bal as any).on_hand))
        : 0;

    const nextOnHand = currentOnHand - qty;

    if (!allowNegativeStock && nextOnHand < 0) {
      return NextResponse.json(
        {
          error: `Stok tidak cukup untuk item "${String(it.name || itemKey)}". Stok saat ini ${currentOnHand}, butuh ${qty}.`,
        },
        { status: 400 }
      );
    }
  }

  // =========================================================
  // APPLY stok satu per satu
  // =========================================================
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
      bal && bal.on_hand != null
        ? Math.floor(num((bal as any).on_hand))
        : 0;

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
        ref_type: "INVOICE",
        ref_id: invoiceId,
        ref_line_id: itemId,
        product_name: itemName,
        qty_in: 0,
        qty_out: qty,
      });

    if (ledErr) {
      return NextResponse.json({ error: ledErr.message }, { status: 400 });
    }
  }

  // =========================================================
  // update status invoice
  // =========================================================
  const { error: sentErr } = await supabase
    .from("invoices")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("org_id", orgId);

  if (sentErr) {
    return NextResponse.json({ error: sentErr.message }, { status: 400 });
  }

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "invoice.sent",
    entity_type: "invoice",
    entity_id: invoiceId,
    summary: `Send invoice ${String((inv as any).invoice_number || invoiceId)}`,
    meta: {
      invoice_id: invoiceId,
      invoice_number: (inv as any).invoice_number || null,
      customer_name: (inv as any).customer_name || null,
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
      status: "sent",
      stock_moved: true,
      warehouse_id: warehouseId,
      items_count: items.length,
    },
    { status: 200 }
  );
}