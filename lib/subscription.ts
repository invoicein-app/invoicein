/**
 * Subscription check for manual monthly billing.
 * Org can write (create/update/post/cancel/receive/adjust) only if not expired.
 * Staff limits: basic => 1, standard => 3 (active staff only, role=staff, is_active=true).
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionStatus = "trial" | "active" | "grace_period" | "expired" | "cancelled";

export type SubscriptionPlan = "basic" | "standard";

export type SubscriptionResult = {
  allowed: boolean;
  status: SubscriptionStatus | null;
  expiresAt: string | null;
  trialEndsAt: string | null;
  plan: SubscriptionPlan;
};

/** Max active staff (role=staff, is_active=true) per plan. */
export function getStaffLimitForPlan(plan: SubscriptionPlan | null | undefined): number {
  if (plan === "standard") return 3;
  return 1; // basic or null
}

/** Count active staff in org (role=staff and is_active=true). Admins are not counted. */
export async function getActiveStaffCount(
  supabase: SupabaseClient,
  orgId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "staff")
    .eq("is_active", true);

  if (error) return 0;
  return typeof count === "number" ? count : 0;
}

/**
 * Returns subscription state for an org. Use server Supabase client (e.g. from route).
 * allowed = true iff org can perform write/state-changing actions (expires_at is null or expires_at > now).
 */
export async function getSubscription(
  supabase: SupabaseClient,
  orgId: string
): Promise<SubscriptionResult> {
  const { data: row, error } = await supabase
    .from("organizations")
    .select("subscription_status, trial_ends_at, expires_at, subscription_plan")
    .eq("id", orgId)
    .maybeSingle();

  if (error || !row) {
    return {
      allowed: false,
      status: null,
      expiresAt: null,
      trialEndsAt: null,
      plan: "basic",
    };
  }

  const status = (row.subscription_status as SubscriptionStatus) || null;
  const expiresAt = row.expires_at ?? null;
  const trialEndsAt = row.trial_ends_at ?? null;
  const now = new Date().toISOString();

  // Legacy: null expires_at = allowed
  const allowed =
    expiresAt === null || expiresAt === "" ? true : expiresAt > now;

  return {
    allowed,
    status,
    expiresAt,
    trialEndsAt,
    plan: (row.subscription_plan as SubscriptionPlan) || "basic",
  };
}

/**
 * Use in write routes after auth. If org is expired, returns a NextResponse to return to client.
 * Otherwise returns null (proceed with request).
 */
export async function requireCanWrite(
  supabase: SupabaseClient,
  orgId: string
): Promise<NextResponse | null> {
  const sub = await getSubscription(supabase, orgId);
  if (sub.allowed) return null;
  return NextResponse.json(
    {
      error:
        "Langganan organisasi sudah berakhir. Silakan perpanjang untuk membuat atau mengubah transaksi.",
    },
    { status: 403 }
  );
}
