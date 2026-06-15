export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { postDeliveryNote } from "@/lib/delivery-note-post";

function isUuid(v: unknown) {
  const s = String(v || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
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

  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId, actorRole } = auth.ctx;

  const result = await postDeliveryNote({
    supabase,
    orgId,
    deliveryNoteId,
    actorUserId: user.id,
    actorRole,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      ok: true,
      status: result.status,
      stock_moved: result.stock_moved,
      reason: result.reason,
      warehouse_id: result.warehouse_id,
      items_count: result.items_count,
    },
    { status: 200 }
  );
}
