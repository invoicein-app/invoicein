export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { logActivity } from "@/lib/log-activity";
import { requireCanWrite } from "@/lib/subscription";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { createProductBodySchema, updateProductBodySchema } from "@/lib/validations/product";

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
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
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
    return {
      error: NextResponse.json({ error: memErr.message }, { status: 400 }),
    };
  }

  if (!membership?.org_id) {
    return {
      error: NextResponse.json(
        { error: "Kamu belum punya organisasi aktif." },
        { status: 400 }
      ),
    };
  }

  return {
    user,
    orgId: String(membership.org_id),
    actorRole: String(membership.role || "staff"),
  };
}

export async function GET(req: NextRequest) {
  const supabase = await getSupabase();

  const auth = await getAuthAndOrg(supabase);
  if ((auth as any).error) return (auth as any).error;

  const { orgId } = auth as any;
  const { searchParams } = new URL(req.url);

  const q = asText(searchParams.get("q"));
  const onlyActive = searchParams.get("active");

  let query = supabase
    .from("products")
    .select("id, org_id, name, sku, unit, price, is_active, created_at, updated_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (onlyActive === "true") {
    query = query.eq("is_active", true);
  }

  if (q) {
    query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,unit.ilike.%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, products: data || [] }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabase();

  const auth = await getAuthAndOrg(supabase);
  if ((auth as any).error) return (auth as any).error;

  const { user, orgId, actorRole } = auth as any;

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const parsedBody = await parseJsonBody(req, createProductBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const { name, sku, unit, price, is_active } = parsedBody.data;

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
    .select("id, org_id, name, sku, unit, price, is_active, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

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

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const parsedBody = await parseJsonBody(req, updateProductBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const { id, ...fields } = parsedBody.data;

  const { data: before, error: beforeErr } = await supabase
    .from("products")
    .select("id, org_id, name, sku, unit, price, is_active")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (beforeErr) {
    return NextResponse.json({ error: beforeErr.message }, { status: 400 });
  }

  if (!before) {
    return NextResponse.json(
      { error: "Product tidak ditemukan / tidak punya akses." },
      { status: 404 }
    );
  }

  const patch: Record<string, unknown> = {};
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.sku !== undefined) patch.sku = fields.sku;
  if (fields.unit !== undefined) patch.unit = fields.unit;
  if (fields.price !== undefined) patch.price = fields.price;
  if (fields.is_active !== undefined) patch.is_active = fields.is_active;

  const { data: row, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id, org_id, name, sku, unit, price, is_active, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "product.update",
    entity_type: "product",
    entity_id: row.id,
    summary: `Update product ${row.name}${row.sku ? ` (${row.sku})` : ""}`,
    meta: {
      before,
      after: row,
      changed_fields: Object.keys(patch),
    },
  });

  return NextResponse.json({ ok: true, product: row }, { status: 200 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await getSupabase();

  const auth = await getAuthAndOrg(supabase);
  if ((auth as any).error) return (auth as any).error;

  const { user, orgId, actorRole } = auth as any;

  const subBlock = await requireCanWrite(supabase, orgId);
  if (subBlock) return subBlock;

  const { searchParams } = new URL(req.url);
  const id = asText(searchParams.get("id"));

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: before, error: beforeErr } = await supabase
    .from("products")
    .select("id, org_id, name, sku, unit, price, is_active")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (beforeErr) {
    return NextResponse.json({ error: beforeErr.message }, { status: 400 });
  }

  if (!before) {
    return NextResponse.json(
      { error: "Product tidak ditemukan / tidak punya akses." },
      { status: 404 }
    );
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logActivity({
    org_id: orgId,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "product.delete",
    entity_type: "product",
    entity_id: id,
    summary: `Delete product ${before.name}`,
    meta: { before },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}