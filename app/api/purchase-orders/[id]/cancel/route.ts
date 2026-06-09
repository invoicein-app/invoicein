// ✅ FULL REPLACE
// invoiceku/app/api/purchase-orders/[id]/cancel/route.ts
// POST -> cancel PO (status = cancelled) + reason optional

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireApiContext, requireWriteForOrg } from "@/lib/api-context";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { cancelPurchaseOrderBodySchema } from "@/lib/validations/purchase-order";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;

  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const parsedBody = await parseJsonBody(req, cancelPurchaseOrderBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const { reason } = parsedBody.data;

  // ambil dulu biar bisa guard status
  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .select("id, org_id, status")
    .eq("id", id)
    .maybeSingle();

  if (poErr) return NextResponse.json({ error: poErr.message }, { status: 400 });
  if (!po) return NextResponse.json({ error: "PO tidak ditemukan" }, { status: 404 });

  const orgId = (po as any).org_id;
  if (orgId) {
    const subBlock = await requireWriteForOrg(supabase, orgId);
    if (subBlock) return subBlock;
  }

  const st = String((po as any).status || "draft").toLowerCase();
  if (st === "cancelled") {
    return NextResponse.json({ ok: true, status: "cancelled" }, { status: 200 });
  }

  // NOTE: kalau nanti ada status lain (received/closed), bisa block cancel di sini
  const { error: upErr } = await supabase
    .from("purchase_orders")
    .update({
      status: "cancelled",
      cancel_reason: reason || null,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, status: "cancelled" }, { status: 200 });
}
