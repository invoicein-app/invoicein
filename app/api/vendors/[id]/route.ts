// ✅ FULL REPLACE
// invoiceku/app/api/vendors/[id]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { logActivity } from "@/lib/log-activity";
import { requireCanWrite } from "@/lib/subscription";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function makeSupabase() {
  const csAny: any = cookies() as any;
  const cookieStore: any = csAny?.then ? await csAny : csAny;

  return createServerClient(
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
}

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function getId(ctx: Ctx) {
  const p: any = (ctx as any)?.params;
  const params = p?.then ? await p : p;
  const id = safeStr(params?.id);
  return id;
}

async function getMembership(supabase: any, userId: string) {
  const { data: membership, error } = await supabase
    .from("memberships")
    .select("org_id, role, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const orgId = String((membership as any)?.org_id || "");
  const actorRole = String((membership as any)?.role || "staff");

  if (!orgId) {
    throw new Error("Org tidak ditemukan. Pastikan membership aktif.");
  }

  return { orgId, actorRole };
}

export async function GET(_req: Request, ctx: Ctx) {
  const supabase = await makeSupabase();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = await getId(ctx);
  if (!id || !isUuid(id)) {
    return NextResponse.json({ error: "Invalid vendor id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("vendors")
    .select("id,org_id,vendor_code,name,phone,email,address,note,is_active,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Vendor tidak ditemukan." }, { status: 404 });

  return NextResponse.json({ vendor: data }, { status: 200 });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const supabase = await makeSupabase();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = userRes.user;

  const { orgId, actorRole } = await getMembership(supabase, user.id);

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const id = await getId(ctx);
  if (!id || !isUuid(id)) {
    return NextResponse.json({ error: "Invalid vendor id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const patch: any = {};
  if (body?.vendor_code !== undefined) patch.vendor_code = safeStr(body.vendor_code) || null;
  if (body?.name !== undefined) patch.name = safeStr(body.name);
  if (body?.phone !== undefined) patch.phone = safeStr(body.phone) || null;
  if (body?.email !== undefined) patch.email = safeStr(body.email) || null;
  if (body?.address !== undefined) patch.address = safeStr(body.address) || null;
  if (body?.note !== undefined) patch.note = safeStr(body.note) || null;
  if (body?.is_active !== undefined) patch.is_active = body.is_active === false ? false : true;

  if (patch.name !== undefined && !patch.name) {
    return NextResponse.json({ error: "Vendor name wajib diisi." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("vendors")
    .update(patch)
    .eq("id", id)
    .select("id,vendor_code,name,is_active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "vendor.update",
    entity_type: "vendor",
    entity_id: data.id,
    summary: `Update vendor ${data.vendor_code} - ${data.name}`,
    meta: { vendor_id: data.id, vendor_code: data.vendor_code, is_active: data.is_active },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

// ✅ Soft delete: set is_active=false (lebih aman buat ERP)
export async function DELETE(_req: Request, ctx: Ctx) {
  const supabase = await makeSupabase();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = userRes.user;

  const { orgId, actorRole } = await getMembership(supabase, user.id);

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const id = await getId(ctx);
  if (!id || !isUuid(id)) {
    return NextResponse.json({ error: "Invalid vendor id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("vendors")
    .update({ is_active: false })
    .eq("id", id)
    .select("id,vendor_code,name")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "vendor.deactivate",
    entity_type: "vendor",
    entity_id: data.id,
    summary: `Deactivate vendor ${data.vendor_code} - ${data.name}`,
    meta: { vendor_id: data.id, vendor_code: data.vendor_code },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
