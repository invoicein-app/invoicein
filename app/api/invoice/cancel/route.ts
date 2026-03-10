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

  const invoiceId = String(body.invoice_id || "").trim();
  if (!isUuid(invoiceId)) {
    return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
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
    return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  }
  if (String((inv as any).org_id || "") !== orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = String((inv as any).status || "").toLowerCase();

  if (status === "cancelled") {
    return NextResponse.json({ error: "Invoice sudah cancelled." }, { status: 400 });
  }

  if (status === "paid") {
    return NextResponse.json(
      { error: "Invoice paid tidak bisa di-cancel langsung." },
      { status: 400 }
    );
  }

  const warehouseId = String((inv as any).warehouse_id || "").trim();

  const { data: outLedgers, error: ledErr } = await supabase
    .from("stock_ledger")
    .select("id, warehouse_id, product_id, ref_type, ref_id, ref_line_id, product_name, qty_in, qty_out")
    .eq("org_id", orgId)
    .eq("ref_type", "INVOICE")
    .eq("ref_id", invoiceId);

  if (ledErr) {
    return NextResponse.json({ error: ledErr.message }, { status: 400 });
  }

  const alreadyReversed = await supabase
    .from("stock_ledger")
    .select("id")
    .eq("org_id", orgId)
    .eq("ref_type", "INVOICE_CANCEL")
    .eq("ref_id", invoiceId)
    .limit(1)
    .maybeSingle();

  if (alreadyReversed.error) {
    return NextResponse.json({ error: alreadyReversed.error.message }, { status: 400 });
  }

  if (alreadyReversed.data) {
    return NextResponse.json(
      { error: "Reversal stok invoice ini sudah pernah diposting." },
      { status: 400 }
    );
  }

  const hasStockMovement = Array.isArray(outLedgers) && outLedgers.length > 0;

  if (hasStockMovement) {
    for (const row of outLedgers as any[]) {
      const whId = String(row.warehouse_id || warehouseId || "").trim();
      const productId = String(row.product_id || "").trim();
      const productName = String(row.product_name || "").trim();
      const qtyOut = Math.max(0, Math.floor(num(row.qty_out)));

      if (!whId || !productId || qtyOut <= 0) continue;

      const { data: bal, error: balErr } = await supabase
        .from("inventory_balances")
        .select("item_key, item_name, on_hand")
        .eq("org_id", orgId)
        .eq("warehouse_id", whId)
        .eq("product_id", productId)
        .maybeSingle();

      if (balErr) {
        return NextResponse.json({ error: balErr.message }, { status: 400 });
      }

      if (!bal) {
        return NextResponse.json(
          { error: `Balance stok untuk barang "${productName}" tidak ditemukan.` },
          { status: 400 }
        );
      }

      const currentOnHand = Math.max(0, Math.floor(num((bal as any).on_hand)));
      const nextOnHand = currentOnHand + qtyOut;

      const { error: upBalErr } = await supabase
        .from("inventory_balances")
        .upsert(
          {
            org_id: orgId,
            warehouse_id: whId,
            product_id: productId,
            item_key: String((bal as any).item_key || "").trim(),
            item_name: String((bal as any).item_name || productName).trim(),
            on_hand: nextOnHand,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "org_id,warehouse_id,item_key" }
        );

      if (upBalErr) {
        return NextResponse.json({ error: upBalErr.message }, { status: 400 });
      }

      const { error: revLedErr } = await supabase
        .from("stock_ledger")
        .insert({
          org_id: orgId,
          warehouse_id: whId,
          product_id: productId,
          ref_type: "INVOICE_CANCEL",
          ref_id: invoiceId,
          ref_line_id: String(row.ref_line_id || row.id || ""),
          product_name: productName,
          qty_in: qtyOut,
          qty_out: 0,
        });

      if (revLedErr) {
        return NextResponse.json({ error: revLedErr.message }, { status: 400 });
      }
    }
  }

  const { error: upInvErr } = await supabase
    .from("invoices")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("org_id", orgId);

  if (upInvErr) {
    return NextResponse.json({ error: upInvErr.message }, { status: 400 });
  }

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "invoice.cancel",
    entity_type: "invoice",
    entity_id: invoiceId,
    summary: `Cancel invoice ${String((inv as any).invoice_number || invoiceId)}`,
    meta: {
      invoice_id: invoiceId,
      invoice_number: (inv as any).invoice_number || null,
      previous_status: status,
      stock_reversed: hasStockMovement,
      warehouse_id: warehouseId || null,
      reversal_lines: hasStockMovement ? outLedgers.length : 0,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      status: "cancelled",
      stock_reversed: hasStockMovement,
      reversal_lines: hasStockMovement ? outLedgers.length : 0,
    },
    { status: 200 }
  );
}