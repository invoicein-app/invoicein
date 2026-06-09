// ✅ NEW FILE
// invoiceku/app/api/warehouses/[id]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { updateWarehouseBodySchema } from "@/lib/validations/warehouse";

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

// ✅ IMPORTANT: params itu Promise
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;

  const { id } = await ctx.params;
  const wid = safeStr(id);

  if (!wid || !isUuid(wid)) return NextResponse.json({ error: "Invalid warehouse id" }, { status: 400 });

  const { data, error } = await supabase
    .from("warehouses")
    .select("id,org_id,code,name,phone,address,is_active,created_at,updated_at")
    .eq("org_id", orgId)
    .eq("id", wid)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Gudang tidak ditemukan." }, { status: 404 });

  return NextResponse.json({ warehouse: data }, { status: 200 });
}

// PATCH -> update (code READ-ONLY: jangan boleh diubah)
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;

  const { id } = await ctx.params;
  const wid = safeStr(id);
  if (!wid || !isUuid(wid)) return NextResponse.json({ error: "Invalid warehouse id" }, { status: 400 });

  const parsedBody = await parseJsonBody(req, updateWarehouseBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.phone !== undefined) patch.phone = body.phone;
  if (body.address !== undefined) patch.address = body.address;
  if (body.is_active !== undefined) patch.is_active = body.is_active;

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
}

// DELETE -> soft delete by set is_active=false
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;

  const { id } = await ctx.params;
  const wid = safeStr(id);
  if (!wid || !isUuid(wid)) return NextResponse.json({ error: "Invalid warehouse id" }, { status: 400 });

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
}
