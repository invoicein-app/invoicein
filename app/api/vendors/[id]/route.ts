// ✅ FULL REPLACE
// invoiceku/app/api/vendors/[id]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { logActivity } from "@/lib/log-activity";
import { requireApiContext } from "@/lib/api-context";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { updateVendorBodySchema } from "@/lib/validations/vendor";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function getId(ctx: Ctx) {
  const p: any = (ctx as any)?.params;
  const params = p?.then ? await p : p;
  const id = safeStr(params?.id);
  return id;
}

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

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
  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId, actorRole } = auth.ctx;

  const id = await getId(ctx);
  if (!id || !isUuid(id)) {
    return NextResponse.json({ error: "Invalid vendor id" }, { status: 400 });
  }

  const parsedBody = await parseJsonBody(req, updateVendorBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const patch: Record<string, unknown> = {};
  if (body.vendor_code !== undefined) patch.vendor_code = body.vendor_code;
  if (body.name !== undefined) patch.name = body.name;
  if (body.phone !== undefined) patch.phone = body.phone;
  if (body.email !== undefined) patch.email = body.email;
  if (body.address !== undefined) patch.address = body.address;
  if (body.note !== undefined) patch.note = body.note;
  if (body.is_active !== undefined) patch.is_active = body.is_active;

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
  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId, actorRole } = auth.ctx;

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
