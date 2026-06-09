// GET next vendor_code preview for current org (heuristic; matches common PREFIX-#### pattern)
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";

export async function GET() {
  const auth = await requireApiContext();
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;

  const { data: rows, error } = await supabase
    .from("vendors")
    .select("vendor_code")
    .eq("org_id", orgId)
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let prefix = "VND";
  let maxNum = 0;
  let foundPattern = false;

  for (const r of rows || []) {
    const c = String((r as { vendor_code?: string }).vendor_code || "").trim();
    if (!c) continue;
    const m = c.match(/^([A-Za-z][A-Za-z0-9_-]*)[-\s]?(\d+)$/);
    if (m) {
      foundPattern = true;
      prefix = m[1].toUpperCase();
      maxNum = Math.max(maxNum, parseInt(m[2], 10));
    } else {
      const digits = c.match(/(\d+)/g);
      if (digits) {
        for (const d of digits) {
          const n = parseInt(d, 10);
          if (!Number.isNaN(n)) maxNum = Math.max(maxNum, n);
        }
      }
    }
  }

  const next = maxNum + 1;
  const preview_code =
    foundPattern || maxNum > 0 ? `${prefix}-${String(next).padStart(4, "0")}` : `${prefix}-0001`;

  return NextResponse.json({ preview_code }, { status: 200 });
}
