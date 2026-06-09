// ✅ NEW FILE
// invoiceku/app/api/warehouses/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { createWarehouseBodySchema } from "@/lib/validations/warehouse";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

// GET /api/warehouses -> list warehouses for active org
export async function GET(req: Request) {
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;

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
}

// POST /api/warehouses -> create warehouse (code auto by trigger; do NOT accept code)
export async function POST(req: Request) {
  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth.ctx;

  const parsedBody = await parseJsonBody(req, createWarehouseBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const { data, error } = await supabase
    .from("warehouses")
    .insert({
      org_id: orgId,
      name: body.name,
      phone: body.phone,
      address: body.address,
      is_active: body.is_active,
      created_by: user.id,
    })
    .select("id,code")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ id: data.id, code: data.code }, { status: 200 });
}
