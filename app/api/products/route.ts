// invoiceku/app/api/products/route.ts  (FULL REPLACE)
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { logActivity } from "@/lib/log-activity";

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function asText(v: any) {
  return String(v ?? "").trim();
}

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

async function getAuthAndOrg(supabase: any) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as any };
  }
  const user = userRes.user;

  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("org_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memErr) {
    return { error: NextResponse.json({ error: memErr.message }, { status: 400 }) as any };
  }
  if (!membership?.org_id) {
    return { error: NextResponse.json({ error: "Kamu belum punya organisasi aktif." }, { status: 400 }) as any };
  }

  const orgId = String(membership.org_id);
  const actorRole = String(membership.role || "staff");

  return { user, orgId, actorRole };
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabase();

  const auth = await getAuthAndOrg(supabase);
  if ((auth as any).error) return (auth as any).error;
  const { user, orgId, actorRole } = auth as any;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const name = asText(body.name);
  const sku = asText(body.sku) || null;
  const unit = asText(body.unit) || null;
  const price = Math.max(0, num(body.price));
  const is_active = body.is_active === false ? false : true;

  if (!name) return NextResponse.json({ error: "Nama barang wajib." }, { status: 400 });

  const { data: row, error } = await supabase
    .from("products")
    .insert({
      org_id: orgId,
      name,
      sku,
      unit,
      price,
      is_active,
      created_by: user.id,
    })
    .select("id, org_id, name, sku, unit, price, is_active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // activity log (best-effort)
  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "product.create",
    entity_type: "product",
    entity_id: row.id,
    summary: `Create product ${row.name}${row.sku ? ` (${row.sku})` : ""}`,
    meta: row,
  });

  return NextResponse.json({ ok: true, product: row }, { status: 200 });
}

export async function PATCH(req: NextRequest) {
  const supabase = await getSupabase();

  const auth = await getAuthAndOrg(supabase);
  if ((auth as any).error) return (auth as any).error;
  const { user, orgId, actorRole } = auth as any;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const id = asText(body.id);
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // ✅ ambil snapshot before (scoped org)
  const { data: before, error: beforeErr } = await supabase
    .from("products")
    .select("id, org_id, name, sku, unit, price, is_active")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (beforeErr) return NextResponse.json({ error: beforeErr.message }, { status: 400 });
  if (!before) return NextResponse.json({ error: "Product tidak ditemukan / tidak punya akses." }, { status: 404 });

  const patch: any = {};
  if (body.name !== undefined) patch.name = asText(body.name);
  if (body.sku !== undefined) patch.sku = asText(body.sku) || null;
  if (body.unit !== undefined) patch.unit = asText(body.unit) || null;
  if (body.price !== undefined) patch.price = Math.max(0, num(body.price));
  if (body.is_active !== undefined) patch.is_active = body.is_active === false ? false : true;

  if (patch.name !== undefined && !patch.name) {
    return NextResponse.json({ error: "Nama barang wajib." }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId) // ✅ scope org
    .select("id, org_id, name, sku, unit, price, is_active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const changed_fields = Object.keys(patch);

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "product.update",
    entity_type: "product",
    entity_id: row.id,
    summary: `Update product ${row.name}${row.sku ? ` (${row.sku})` : ""}`,
    meta: { changed_fields, before, after: row },
  });

  return NextResponse.json({ ok: true, product: row }, { status: 200 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await getSupabase();

  const auth = await getAuthAndOrg(supabase);
  if ((auth as any).error) return (auth as any).error;
  const { user, orgId, actorRole } = auth as any;

  const { searchParams } = new URL(req.url);
  const id = asText(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // ✅ snapshot before (scoped org)
  const { data: before, error: beforeErr } = await supabase
    .from("products")
    .select("id, org_id, name, sku, unit, price, is_active")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (beforeErr) return NextResponse.json({ error: beforeErr.message }, { status: 400 });
  if (!before) return NextResponse.json({ error: "Product tidak ditemukan / tidak punya akses." }, { status: 404 });

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId); // ✅ scope org

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "product.delete",
    entity_type: "product",
    entity_id: id,
    summary: `Delete product ${before?.name || id}`,
    meta: { before },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}