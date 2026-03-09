// ✅ NEW FILE
// invoiceku/app/api/warehouses/[id]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
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
            cookiesToSet.forEach(({ name, value, options }: any) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );
}

async function getMembershipOrg(supabase: any, userId: string) {
  const { data: membership, error } = await supabase
    .from("memberships")
    .select("org_id, role, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const orgId = String((membership as any)?.org_id || "");
  const role = String((membership as any)?.role || "staff");
  return { orgId, role };
}

// ✅ IMPORTANT: params itu Promise
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await makeSupabase();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const wid = safeStr(id);

  if (!wid || !isUuid(wid)) return NextResponse.json({ error: "Invalid warehouse id" }, { status: 400 });

  try {
    const { orgId } = await getMembershipOrg(supabase, userRes.user.id);
    if (!orgId) return NextResponse.json({ error: "Org tidak ditemukan." }, { status: 400 });

    const { data, error } = await supabase
      .from("warehouses")
      .select("id,org_id,code,name,phone,address,is_active,created_at,updated_at")
      .eq("org_id", orgId)
      .eq("id", wid)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Gudang tidak ditemukan." }, { status: 404 });

    return NextResponse.json({ warehouse: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal load gudang." }, { status: 400 });
  }
}

// PATCH -> update (code READ-ONLY: jangan boleh diubah)
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await makeSupabase();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const wid = safeStr(id);
  if (!wid || !isUuid(wid)) return NextResponse.json({ error: "Invalid warehouse id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  try {
    const { orgId } = await getMembershipOrg(supabase, userRes.user.id);
    if (!orgId) return NextResponse.json({ error: "Org tidak ditemukan." }, { status: 400 });

    const patch: any = {};

    // ✅ code sengaja diabaikan (read-only)
    if (body?.name !== undefined) patch.name = safeStr(body.name);
    if (body?.phone !== undefined) patch.phone = safeStr(body.phone) || null;
    if (body?.address !== undefined) patch.address = safeStr(body.address);
    if (body?.is_active !== undefined) patch.is_active = body.is_active === false ? false : true;

    if (patch.name !== undefined && !patch.name) {
      return NextResponse.json({ error: "Nama gudang wajib diisi." }, { status: 400 });
    }
    if (patch.address !== undefined && !patch.address) {
      return NextResponse.json({ error: "Alamat gudang wajib diisi." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("warehouses")
      .update(patch)
      .eq("org_id", orgId)
      .eq("id", wid)
      .select("id,code,name,phone,address,is_active,created_at,updated_at")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Gudang tidak ditemukan." }, { status: 404 });

    return NextResponse.json({ warehouse: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal simpan gudang." }, { status: 400 });
  }
}

// DELETE -> soft delete by set is_active=false
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await makeSupabase();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const wid = safeStr(id);
  if (!wid || !isUuid(wid)) return NextResponse.json({ error: "Invalid warehouse id" }, { status: 400 });

  try {
    const { orgId } = await getMembershipOrg(supabase, userRes.user.id);
    if (!orgId) return NextResponse.json({ error: "Org tidak ditemukan." }, { status: 400 });

    const { data, error } = await supabase
      .from("warehouses")
      .update({ is_active: false })
      .eq("org_id", orgId)
      .eq("id", wid)
      .select("id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Gudang tidak ditemukan." }, { status: 404 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal hapus gudang." }, { status: 400 });
  }
}
