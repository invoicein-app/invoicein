// ✅ FULL REPLACE
// invoiceku/app/api/vendors/create/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { logActivity } from "@/lib/log-activity";
import { requireCanWrite } from "@/lib/subscription";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

export async function POST(req: Request) {
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
  const actorRole = String((membership as any).role || "staff");

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  // body
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const name = safeStr(body?.name);
  if (!name) return NextResponse.json({ error: "Vendor name wajib diisi." }, { status: 400 });

  const payload = {
    org_id: orgId,
    vendor_code: safeStr(body?.vendor_code) || null, // ✅ optional, kalau kosong trigger isi otomatis
    name,
    phone: safeStr(body?.phone) || null,
    email: safeStr(body?.email) || null,
    address: safeStr(body?.address) || null,
    note: safeStr(body?.note) || null,
    is_active: body?.is_active === false ? false : true,
    created_by: user.id,
  };

  const { data: v, error: vErr } = await supabase
    .from("vendors")
    .insert(payload)
    .select("id,vendor_code,name")
    .single();

  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 400 });

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "vendor.create",
    entity_type: "vendor",
    entity_id: v.id,
    summary: `Create vendor ${v.vendor_code} - ${v.name}`,
    meta: { vendor_id: v.id, vendor_code: v.vendor_code, name: v.name },
  });

  return NextResponse.json({ id: v.id, vendor_code: v.vendor_code }, { status: 200 });
}
