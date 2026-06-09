// ✅ FULL REPLACE
// invoiceku/app/api/purchase-orders/[id]/delete/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { logActivity } from "@/lib/log-activity";
import { requireApiContext, isAdminRole } from "@/lib/api-context";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId, actorRole } = auth.ctx;
  const role = actorRole;
  const isAdmin = isAdminRole(role);

  // ambil PO (RLS tetap jalan)
  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .select("id, org_id, po_number, status")
    .eq("id", id)
    .maybeSingle();

  if (poErr) return NextResponse.json({ error: poErr.message }, { status: 400 });
  if (!po) return NextResponse.json({ error: "PO tidak ditemukan / tidak punya akses." }, { status: 404 });

  const status = String(po.status || "").toLowerCase();

  // 🔒 RULE UTAMA
  if (status !== "draft") {
    return NextResponse.json(
      { error: "PO hanya bisa dihapus saat status masih DRAFT." },
      { status: 400 }
    );
  }

  // 🔒 STAFF rule (explicit, biar jelas & future-proof)
  if (!isAdmin && status !== "draft") {
    return NextResponse.json(
      { error: "Staff hanya boleh menghapus PO draft." },
      { status: 403 }
    );
  }

  // delete items
  const { error: delItemsErr } = await supabase
    .from("purchase_order_items")
    .delete()
    .eq("purchase_order_id", id);

  if (delItemsErr) return NextResponse.json({ error: delItemsErr.message }, { status: 400 });

  // delete PO
  const { error: delPoErr } = await supabase
    .from("purchase_orders")
    .delete()
    .eq("id", id);

  if (delPoErr) return NextResponse.json({ error: delPoErr.message }, { status: 400 });

  // log
  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: role,
    action: "po.delete",
    entity_type: "purchase_order",
    entity_id: id,
    summary: `Delete PO ${po.po_number || id}`,
    meta: {
      po_id: id,
      po_number: po.po_number ?? null,
      status: po.status ?? null,
      role,
    },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
