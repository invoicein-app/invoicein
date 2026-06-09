// ✅ FULL REPLACE
// invoiceku/app/api/purchase-orders/[id]/route.ts
//
// Fix error Next.js: params itu Promise (harus await)
// Sama kayak route PDF kamu yang sudah benar.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { logActivity } from "@/lib/log-activity";
import { requireApiContext, isAdminRole } from "@/lib/api-context";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params; // ✅ FIX
  const poId = String(id || "").trim();
  if (!poId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId, actorRole } = auth.ctx;
  const role = actorRole;

  // gate: org + status
  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .select("id, org_id, po_number, status")
    .eq("id", poId)
    .maybeSingle();

  if (poErr) return NextResponse.json({ error: poErr.message }, { status: 400 });
  if (!po) return NextResponse.json({ error: "PO tidak ditemukan." }, { status: 404 });
  if (String((po as any).org_id || "") !== orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = String((po as any).status || "draft").toLowerCase();
  const isDraft = status === "draft";

  // ✅ STAFF: draft only
  if (!isAdminRole(role) && !isDraft) {
    return NextResponse.json({ error: "Staff hanya boleh hapus PO dengan status DRAFT." }, { status: 403 });
  }

  // ✅ extra safety: delete hanya draft (admin pun)
  if (!isDraft) {
    return NextResponse.json({ error: "PO hanya boleh dihapus saat status masih DRAFT." }, { status: 400 });
  }

  // delete items
  const { error: delItemsErr } = await supabase
    .from("purchase_order_items")
    .delete()
    .eq("purchase_order_id", poId);

  if (delItemsErr) return NextResponse.json({ error: delItemsErr.message }, { status: 400 });

  // delete header
  const { error: delPoErr } = await supabase.from("purchase_orders").delete().eq("id", poId);
  if (delPoErr) return NextResponse.json({ error: delPoErr.message }, { status: 400 });

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: role,
    action: "po.delete",
    entity_type: "purchase_order",
    entity_id: poId,
    summary: `Delete PO ${(po as any).po_number || poId}`,
    meta: { po_id: poId, po_number: (po as any).po_number ?? null },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
