export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireCanWrite } from "@/lib/subscription";

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isUuid(v: any) {
  const s = String(v || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function safeDateOrNull(v: any) {
  const s = String(v || "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function canReceiveStatus(status: string) {
  const st = String(status || "").toLowerCase();
  return st === "sent" || st === "partially_received";
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

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid PO id" }, { status: 400 });
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

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = userRes.user;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { warehouse_id, sj_no, received_date, notes, lines } = body as any;

  if (!isUuid(warehouse_id)) {
    return NextResponse.json({ error: "warehouse_id wajib UUID" }, { status: 400 });
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ error: "Lines kosong" }, { status: 400 });
  }

  const normLines = (lines as any[])
    .map((x) => ({
      po_item_id: String(x?.po_item_id || "").trim(),
      item_name: String(x?.item_name || "").trim(),
      qty_received: Math.max(0, Math.floor(num(x?.qty_received))),
      production_date: safeDateOrNull(x?.production_date),
      expired_date: safeDateOrNull(x?.expired_date),
    }))
    .filter((x) => isUuid(x.po_item_id) && x.qty_received > 0);

  if (normLines.length === 0) {
    return NextResponse.json({ error: "Minimal 1 item qty_received > 0" }, { status: 400 });
  }

  const { data: mem, error: memErr } = await supabase
    .from("memberships")
    .select("org_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });
  if (!mem?.org_id) {
    return NextResponse.json({ error: "Kamu belum punya organisasi aktif." }, { status: 400 });
  }

  const orgId = String((mem as any).org_id);

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .select("id, org_id, status")
    .eq("id", id)
    .maybeSingle();

  if (poErr) return NextResponse.json({ error: poErr.message }, { status: 400 });
  if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });
  if (String((po as any).org_id || "") !== orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const st = String((po as any).status || "").toLowerCase();
  if (!canReceiveStatus(st)) {
    return NextResponse.json(
      { error: "PO status harus SENT atau PARTIALLY_RECEIVED untuk receive." },
      { status: 400 }
    );
  }

  const { data: poItems, error: itErr } = await supabase
    .from("purchase_order_items")
    .select("id, qty, name, product_id")
    .eq("purchase_order_id", id);

  if (itErr) return NextResponse.json({ error: itErr.message }, { status: 400 });

  const poItemIds = ((poItems as any[]) || []).map((x) => String(x.id));
  const lineIds = normLines.map((x) => x.po_item_id);

  for (const lineId of lineIds) {
    if (!poItemIds.includes(lineId)) {
      return NextResponse.json({ error: "Ada item yang bukan milik PO ini." }, { status: 400 });
    }
  }

  const poItemMap = new Map<string, any>();
  ((poItems as any[]) || []).forEach((x) => {
    poItemMap.set(String(x.id), x);
  });

  const orderedMap = new Map<string, number>();
  ((poItems as any[]) || []).forEach((x) => {
    orderedMap.set(String(x.id), Math.max(0, Math.floor(num(x.qty))));
  });

  const { data: alreadyRows, error: alreadyErr } = await supabase
    .from("po_receipt_lines")
    .select("po_item_id, qty_received")
    .in("po_item_id", lineIds);

  if (alreadyErr) return NextResponse.json({ error: alreadyErr.message }, { status: 400 });

  const alreadyMap = new Map<string, number>();
  (alreadyRows as any[] | null)?.forEach((r) => {
    const key = String(r.po_item_id || "");
    const val = Math.max(0, Math.floor(num(r.qty_received)));
    alreadyMap.set(key, (alreadyMap.get(key) || 0) + val);
  });

  for (const ln of normLines) {
    const ordered = orderedMap.get(ln.po_item_id);
    if (ordered == null) {
      return NextResponse.json({ error: "Ada item yang bukan milik PO ini." }, { status: 400 });
    }
    const already = alreadyMap.get(ln.po_item_id) || 0;
    const remaining = Math.max(0, ordered - already);
    if (ln.qty_received > remaining) {
      return NextResponse.json(
        { error: "Qty diterima melebihi remaining untuk salah satu item." },
        { status: 400 }
      );
    }
  }

  // Ambil product detail supaya bisa isi item_key + product_id ke stok
  const productIds = [...new Set(
    normLines
      .map((ln) => String(poItemMap.get(ln.po_item_id)?.product_id || "").trim())
      .filter(Boolean)
  )];

  const { data: products, error: prodErr } = productIds.length
    ? await supabase
        .from("products")
        .select("id, name, sku")
        .eq("org_id", orgId)
        .in("id", productIds)
    : { data: [], error: null as any };

  if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 400 });

  const productMap = new Map<string, any>();
  ((products as any[]) || []).forEach((p) => {
    productMap.set(String(p.id), p);
  });

  for (const ln of normLines) {
    const poItem = poItemMap.get(ln.po_item_id);
    const productId = String(poItem?.product_id || "").trim();
    if (!productId) {
      return NextResponse.json(
        { error: `PO item "${ln.item_name}" belum linked ke product.` },
        { status: 400 }
      );
    }
    if (!productMap.get(productId)) {
      return NextResponse.json(
        { error: `Product untuk item "${ln.item_name}" tidak ditemukan.` },
        { status: 400 }
      );
    }
  }

  // 1) insert header receipt
  const { data: header, error: hErr } = await supabase
    .from("po_receipts")
    .insert({
      org_id: orgId,
      po_id: id,
      warehouse_id,
      sj_no: sj_no ? String(sj_no).trim() : null,
      received_by: user.id,
      received_date: safeDateOrNull(received_date) || null,
      notes: notes ? String(notes).trim() : null,
    })
    .select("id")
    .single();

  if (hErr) return NextResponse.json({ error: hErr.message }, { status: 400 });

  // 2) insert receipt lines
  const payloadLines = normLines.map((ln) => ({
    receipt_id: header.id,
    po_item_id: ln.po_item_id,
    item_name: ln.item_name,
    qty_received: ln.qty_received,
    production_date: ln.production_date,
    expired_date: ln.expired_date,
  }));

  const { data: insertedLines, error: lErr } = await supabase
    .from("po_receipt_lines")
    .insert(payloadLines)
    .select("id, po_item_id");

  if (lErr) {
    await supabase.from("po_receipts").delete().eq("id", header.id);
    return NextResponse.json({ error: lErr.message }, { status: 400 });
  }

  const receiptLineMap = new Map<string, string>();
  ((insertedLines as any[]) || []).forEach((x) => {
    receiptLineMap.set(String(x.po_item_id), String(x.id));
  });

  // 3) update inventory balance + ledger
  for (const ln of normLines) {
    const poItem = poItemMap.get(ln.po_item_id);
    const productId = String(poItem?.product_id || "").trim();
    const product = productMap.get(productId);

    const productName = String(product?.name || ln.item_name || "").trim();
    const itemKey = toKey(String(product?.sku || "").trim() || productName);
    const qtyIn = Math.max(0, Math.floor(num(ln.qty_received)));

    const { data: bal, error: balErr } = await supabase
      .from("inventory_balances")
      .select("on_hand")
      .eq("org_id", orgId)
      .eq("warehouse_id", warehouse_id)
      .eq("product_id", productId)
      .maybeSingle();

    if (balErr) {
      return NextResponse.json({ error: balErr.message }, { status: 400 });
    }

    const currentOnHand =
      bal && bal.on_hand != null ? Math.floor(num((bal as any).on_hand)) : 0;

    const nextOnHand = currentOnHand + qtyIn;

    const { error: upBalErr } = await supabase
      .from("inventory_balances")
      .upsert(
        {
          org_id: orgId,
          warehouse_id,
          product_id: productId,
          item_key: itemKey,
          item_name: productName,
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
        warehouse_id,
        product_id: productId,
        ref_type: "PO_RECEIVE",
        ref_id: header.id,
        ref_line_id: receiptLineMap.get(ln.po_item_id) || null,
        product_name: productName,
        qty_in: qtyIn,
        qty_out: 0,
      });

    if (ledErr) {
      return NextResponse.json({ error: ledErr.message }, { status: 400 });
    }
  }

  // 4) hitung ulang status PO
  const poItemIdsAll = ((poItems as any[]) || []).map((x) => x.id);

  const { data: allRecLines, error: allRecErr } = await supabase
    .from("po_receipt_lines")
    .select("po_item_id, qty_received")
    .in("po_item_id", poItemIdsAll);

  if (allRecErr) return NextResponse.json({ error: allRecErr.message }, { status: 400 });

  const totalRecvMap = new Map<string, number>();
  (allRecLines as any[] | null)?.forEach((r) => {
    const key = String(r.po_item_id || "");
    const val = Math.max(0, Math.floor(num(r.qty_received)));
    totalRecvMap.set(key, (totalRecvMap.get(key) || 0) + val);
  });

  let allDone = true;
  let anyRecv = false;

  for (const it of (poItems as any[]) || []) {
    const ordered = Math.max(0, Math.floor(num(it.qty)));
    const got = Math.max(0, Math.floor(num(totalRecvMap.get(String(it.id)) || 0)));
    if (got > 0) anyRecv = true;
    if (got < ordered) allDone = false;
  }

  const nextStatus = allDone ? "received" : anyRecv ? "partially_received" : "sent";

  const { error: upErr } = await supabase
    .from("purchase_orders")
    .update({
      status: nextStatus,
      received_at: allDone ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  return NextResponse.json(
    { ok: true, receipt_id: header.id, po_status: nextStatus },
    { status: 200 }
  );
}