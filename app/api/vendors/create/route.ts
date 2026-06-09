// ✅ FULL REPLACE
// invoiceku/app/api/vendors/create/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { logActivity } from "@/lib/log-activity";
import { requireApiContext } from "@/lib/api-context";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { createVendorBodySchema } from "@/lib/validations/vendor";

export async function POST(req: Request) {
  const auth = await requireApiContext({ requireWrite: true });
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId, actorRole } = auth.ctx;

  const parsedBody = await parseJsonBody(req, createVendorBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const payload = {
    org_id: orgId,
    vendor_code: body.vendor_code,
    name: body.name,
    phone: body.phone,
    email: body.email,
    address: body.address,
    note: body.note,
    is_active: body.is_active,
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
