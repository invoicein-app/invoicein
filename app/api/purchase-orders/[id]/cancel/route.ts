// ✅ FULL REPLACE
// invoiceku/app/api/purchase-orders/[id]/cancel/route.ts
// POST -> cancel PO (status = cancelled) + reason optional

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireCanWrite } from "@/lib/subscription";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;

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

  const body = await req.json().catch(() => ({}));
  const reason = String(body?.reason || "").trim();

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
    const subBlock = await requireCanWrite(supabase, orgId);
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
