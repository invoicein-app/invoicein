/**
 * Lightweight check: can the current session access billing admin UI/API?
 * Uses the same gate as /admin/billing and /api/admin/billing.
 */
export const runtime = "nodejs";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getBillingAdminAuth } from "@/lib/billing-admin";

export async function GET() {
  const csAny: any = cookies() as any;
  const cookieStore = csAny?.then ? await csAny : csAny;
  const auth = await getBillingAdminAuth(cookieStore);
  if (!auth.ok) {
    return NextResponse.json({ allowed: false });
  }
  return NextResponse.json({ allowed: true });
}
