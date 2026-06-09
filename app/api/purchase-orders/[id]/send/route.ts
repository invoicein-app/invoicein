export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireApiContext, requireWriteForOrg } from "@/lib/api-context";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const poId = String(id || "").trim();

  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id, org_id, status")
    .eq("id", poId)
    .maybeSingle();

  if (!po) return NextResponse.json({ error: "PO tidak ditemukan." }, { status: 404 });
  const orgId = (po as any).org_id;
  if (orgId) {
    const subBlock = await requireWriteForOrg(supabase, orgId);
    if (subBlock) return subBlock;
  }
  if ((po as any).status !== "draft")
    return NextResponse.json({ error: "Hanya DRAFT yang bisa di-SEND." }, { status: 400 });

  const { error } = await supabase
    .from("purchase_orders")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", poId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
