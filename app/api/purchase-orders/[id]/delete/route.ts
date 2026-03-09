// ✅ FULL REPLACE
// invoiceku/app/api/purchase-orders/[id]/delete/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { logActivity } from "@/lib/log-activity";

function isAdminRole(role: string) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "owner" || r === "super_admin";
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

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

  // auth
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = userRes.user;

  // membership
  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("org_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });
  if (!membership?.org_id) {
    return NextResponse.json({ error: "Kamu belum punya organisasi aktif." }, { status: 400 });
  }

  const orgId = String(membership.org_id);
  const role = String(membership.role || "staff");
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
