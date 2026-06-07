export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAuthAndOrg, getSupabaseFromCookies } from "@/lib/api-auth-org";
import { searchOrgManualItems } from "@/lib/org-manual-items";

export async function GET(req: NextRequest) {
  const supabase = await getSupabaseFromCookies();
  const auth = await getAuthAndOrg(supabase);
  if ("error" in auth && auth.error) return auth.error;

  const { orgId } = auth;
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
