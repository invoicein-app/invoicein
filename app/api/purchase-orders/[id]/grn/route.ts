export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const poId = String(id || "").trim();

  const csAny: any = cookies() as any;
  const cookieStore: any = csAny?.then ? await csAny : csAny;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const {
    warehouse_id,
    sj_no,
    received_date,
    notes,
    lines, // [{ po_item_id, qty_received, production_date, expired_date }]
  } = body;

  if (!warehouse_id)
    return NextResponse.json({ error: "Warehouse wajib." }, { status: 400 });

  if (!Array.isArray(lines) || lines.length === 0)
    return NextResponse.json({ error: "Minimal 1 item diterima." }, { status: 400 });

  // Insert header
  const { data: header, error: headErr } = await supabase
    .from("po_receipts")
    .insert({
      po_id: poId,
      warehouse_id,
      sj_no: sj_no || null,
      received_by: userRes.user.id,
      received_date: received_date || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (headErr)
    return NextResponse.json({ error: headErr.message }, { status: 400 });

  const receiptId = header.id;

  // Insert lines
  const payloadLines = lines
    .filter((l: any) => Number(l.qty_received) > 0)
    .map((l: any) => ({
      receipt_id: receiptId,
      po_item_id: l.po_item_id,
      qty_received: Number(l.qty_received),
      production_date: l.production_date || null,
      expired_date: l.expired_date || null,
    }));

  const { error: lineErr } = await supabase
    .from("po_receipt_lines")
    .insert(payloadLines);

  if (lineErr)
    return NextResponse.json({ error: lineErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}