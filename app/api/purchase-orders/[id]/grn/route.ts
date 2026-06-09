export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireCanWrite } from "@/lib/subscription";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { grnPurchaseOrderBodySchema } from "@/lib/validations/purchase-order";

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

  const { data: poRow } = await supabase
    .from("purchase_orders")
    .select("org_id")
    .eq("id", poId)
    .maybeSingle();
  const orgId = (poRow as any)?.org_id;
  if (orgId) {
    const subBlock = await requireCanWrite(supabase, orgId);
    if (subBlock) return subBlock;
  }

  const parsedBody = await parseJsonBody(req, grnPurchaseOrderBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const { warehouse_id, sj_no, received_date, notes, lines } = parsedBody.data;

  // Insert header
  const { data: header, error: headErr } = await supabase
    .from("po_receipts")
    .insert({
      po_id: poId,
      warehouse_id,
      sj_no,
      received_by: userRes.user.id,
      received_date,
      notes,
    })
    .select()
    .single();

  if (headErr)
    return NextResponse.json({ error: headErr.message }, { status: 400 });

  const receiptId = header.id;

  // Insert lines
  const payloadLines = lines.map((l) => ({
    receipt_id: receiptId,
    po_item_id: l.po_item_id,
    qty_received: l.qty_received,
    production_date: l.production_date ?? null,
    expired_date: l.expired_date ?? null,
  }));

  const { error: lineErr } = await supabase
    .from("po_receipt_lines")
    .insert(payloadLines);

  if (lineErr)
    return NextResponse.json({ error: lineErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}