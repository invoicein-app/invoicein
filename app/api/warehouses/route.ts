// ✅ NEW FILE
// invoiceku/app/api/warehouses/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireCanWrite } from "@/lib/subscription";

function safeStr(v: any) {
  return String(v ?? "").trim();
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

// GET /api/warehouses -> list warehouses for active org
export async function GET(req: Request) {
  const supabase = await makeSupabase();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { orgId } = await getMembershipOrg(supabase, userRes.user.id);
    if (!orgId) return NextResponse.json({ error: "Org tidak ditemukan." }, { status: 400 });

    const url = new URL(req.url);
    const activeOnly = url.searchParams.get("active") === "1";

    let q = supabase
      .from("warehouses")
      .select("id,org_id,code,name,phone,address,is_active,created_at,updated_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (activeOnly) q = q.eq("is_active", true);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ warehouses: data || [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal load warehouses." }, { status: 400 });
  }
}

// POST /api/warehouses -> create warehouse (code auto by trigger; do NOT accept code)
export async function POST(req: Request) {
  const supabase = await makeSupabase();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  try {
    const { orgId } = await getMembershipOrg(supabase, userRes.user.id);
    if (!orgId) return NextResponse.json({ error: "Org tidak ditemukan." }, { status: 400 });

    const subBlock = await requireCanWrite(supabase, orgId);
    if (subBlock) return subBlock;

    const name = safeStr(body?.name);
    const address = safeStr(body?.address);
    const phone = safeStr(body?.phone) || null;
    const is_active = body?.is_active === false ? false : true;

    if (!name) return NextResponse.json({ error: "Nama gudang wajib diisi." }, { status: 400 });
    if (!address) return NextResponse.json({ error: "Alamat wajib diisi." }, { status: 400 });

    // ✅ code jangan dikirim (biar trigger isi)
    const { data, error } = await supabase
      .from("warehouses")
      .insert({
        org_id: orgId,
        name,
        phone,
        address,
        is_active,
        created_by: userRes.user.id,
      })
      .select("id,code")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ id: data.id, code: data.code }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal simpan gudang." }, { status: 400 });
  }
}
