export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { finalizeInvoice } from "@/lib/invoice-finalize";
import { requireApiContext } from "@/lib/api-context";

function isUuid(v: unknown) {
  const s = String(v || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const invoiceId = String(id || "").trim();

  if (!isUuid(invoiceId)) {
    return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
  }

  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId, actorRole } = auth.ctx;

  const result = await finalizeInvoice({
    supabase,
    orgId,
    invoiceId,
    userId: user.id,
    actorRole,
    fromLegacySend: true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }

  return NextResponse.json(
    {
      ok: true,
      status: result.status,
      stock_moved: result.stock_moved,
      reason: result.reason,
    },
    { status: 200 }
  );
}
