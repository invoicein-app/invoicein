export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import {
  loadBookkeepingPreference,
  saveBookkeepingPreference,
} from "@/lib/member-preferences";
import { parseJsonBody } from "@/lib/validations/parse-request";
import { memberPreferencesBodySchema } from "@/lib/validations/member";

export async function GET() {
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;

  const { user, orgId } = auth.ctx;

  const result = await loadBookkeepingPreference(user.id, orgId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    show_invoice_bookkeeping_status: result.show_invoice_bookkeeping_status,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;

  const { user, orgId } = auth.ctx;

  const parsedBody = await parseJsonBody(req, memberPreferencesBodySchema);
  if (!parsedBody.ok) return parsedBody.response;

  const result = await saveBookkeepingPreference(
    user.id,
    orgId,
    parsedBody.data.show_invoice_bookkeeping_status
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    show_invoice_bookkeeping_status: result.show_invoice_bookkeeping_status,
  });
}
