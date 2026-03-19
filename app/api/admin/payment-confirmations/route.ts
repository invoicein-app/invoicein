/**
 * Billing admin: list payment confirmations (default: pending).
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

  const status = req.nextUrl.searchParams.get("status")?.toLowerCase() || "pending";

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY belum di-set" }, { status: 500 });
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  let query = admin
    .from("payment_confirmations")
    .select("id, org_id, user_id, target_package, sender_account_name, sender_bank, sender_account_number, transfer_amount, transfer_date, note, status, admin_note, resolved_at, resolved_by, created_at, organizations(name, org_code)")
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data: rows, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ confirmations: rows || [] }, { status: 200 });
}
