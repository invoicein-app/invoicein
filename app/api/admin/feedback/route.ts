/**
 * Billing admin inbox for feedback (Kritik & Masukan).
 * MVP: filter by status, only for org admin.
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";

export async function GET(req: NextRequest) {
  const status = String(req.nextUrl.searchParams.get("status") ?? "new").toLowerCase();
  const statusParam = status === "all" ? "all" : status;

  if (statusParam !== "all" && !["new", "read", "processed", "done"].includes(statusParam)) {
    return NextResponse.json({ error: "status tidak valid." }, { status: 400 });
  }

  const auth = await requireApiContext({ requireAdmin: true });
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth.ctx;

  let query = supabase
    .from("feedback_submissions")
    .select("id, org_code, user_id, name, email, category, message, current_route, status, admin_note, reviewed_at, reviewed_by, created_at, updated_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (statusParam !== "all") query = query.eq("status", statusParam);

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ feedback: rows || [] }, { status: 200 });
}
