/**
 * Billing admin: list subscription change history for an org.
 * Access gated via lib/billing-admin.
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getBillingAdminAuth } from "@/lib/billing-admin";

export async function GET(req: NextRequest) {
  const csAny: any = cookies() as any;
  const cookieStore = csAny?.then ? await csAny : csAny;
  const auth = await getBillingAdminAuth(cookieStore);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const orgId = req.nextUrl.searchParams.get("org_id")?.trim() ?? "";
  if (!orgId) return NextResponse.json({ error: "org_id wajib." }, { status: 400 });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY belum di-set" }, { status: 500 });
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: rows, error } = await admin
    .from("subscription_history")
    .select("id, org_code, previous_plan, new_plan, previous_expires_at, new_expires_at, changed_at, note")
    .eq("org_id", orgId)
    .order("changed_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ history: rows || [] }, { status: 200 });
}
