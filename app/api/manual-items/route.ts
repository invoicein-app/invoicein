export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { searchOrgManualItems } from "@/lib/org-manual-items";

export async function GET(req: NextRequest) {
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;
  const sp = req.nextUrl.searchParams;
  const q = String(sp.get("q") || "").trim();
  const limitRaw = Number(sp.get("limit") || 50);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;

  const items = await searchOrgManualItems({
    supabase,
    orgId,
    query: q || undefined,
    limit,
  });

  return NextResponse.json({ ok: true, items });
}
