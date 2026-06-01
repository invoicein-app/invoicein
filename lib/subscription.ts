/**
 * Subscription check for manual monthly billing.
 * Org can write only when subscription is not expired.
 * Staff limits: basic => 1, standard => 3.
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "grace_period"
  | "expired"
  | "cancelled";

export type SubscriptionPlan = "basic" | "standard";

export type OrgSubscriptionRow = {
  subscription_status?: string | null;
  subscription_started_at?: string | null;
  trial_ends_at?: string | null;
  expires_at?: string | null;
  subscription_plan?: string | null;
};

export type SubscriptionResult = {
  allowed: boolean;
  status: SubscriptionStatus | null;
  expiresAt: string | null;
  trialEndsAt: string | null;
  startedAt: string | null;
  plan: SubscriptionPlan;
  expired: boolean;
  periodEndAt: string | null;
};

const DEFAULT_TRIAL_DAYS = 30;

/** Configurable via SUBSCRIPTION_TRIAL_DAYS (e.g. 7, 14, 30, 60). */
export function getTrialDays(): number {
  const raw = process.env.SUBSCRIPTION_TRIAL_DAYS;
  if (!raw) return DEFAULT_TRIAL_DAYS;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TRIAL_DAYS;
}

export function addDaysIso(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Fields to set when creating a new organization. */
export function buildNewOrgSubscriptionFields(start: Date = new Date()) {
  const started = start.toISOString();
  const ends = addDaysIso(getTrialDays(), start);
  return {
    subscription_status: "trial" as const,
    subscription_plan: "basic" as const,
    subscription_started_at: started,
    trial_ends_at: ends,
    expires_at: ends,
  };
}

/** End of current billing/trial period (expires_at preferred, then trial_ends_at for trial). */
export function resolvePeriodEnd(row: OrgSubscriptionRow): string | null {
  const expires = row.expires_at ?? null;
  if (expires) return expires;
  const status = String(row.subscription_status || "").toLowerCase();
  if (status === "trial" && row.trial_ends_at) return row.trial_ends_at;
  return row.trial_ends_at ?? null;
}

export function isSubscriptionExpired(
  row: OrgSubscriptionRow,
  now: Date = new Date()
): boolean {
  const status = String(row.subscription_status || "").toLowerCase();
  if (status === "expired" || status === "cancelled") return true;

  const endRaw = resolvePeriodEnd(row);
  if (!endRaw) return true;

  return new Date(endRaw) <= now;
}

export function getSubscriptionStatus(
  row: OrgSubscriptionRow,
  now: Date = new Date()
): SubscriptionStatus | null {
  const stored = String(row.subscription_status || "").toLowerCase();
  if (
    stored === "trial" ||
    stored === "active" ||
    stored === "grace_period" ||
    stored === "expired" ||
    stored === "cancelled"
  ) {
    if (isSubscriptionExpired(row, now) && stored !== "cancelled") {
      return "expired";
    }
    return stored as SubscriptionStatus;
  }

  if (isSubscriptionExpired(row, now)) return "expired";
  if (row.trial_ends_at || row.expires_at) return "trial";
  return null;
}

export function canWriteSubscription(row: OrgSubscriptionRow, now: Date = new Date()): boolean {
  const status = String(row.subscription_status || "").toLowerCase();
  if (status === "cancelled") return false;
  return !isSubscriptionExpired(row, now);
}

/** Max active staff per plan. */
export function getStaffLimitForPlan(plan: SubscriptionPlan | null | undefined): number {
  if (plan === "standard") return 3;
  return 1;
}

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

export async function getSubscription(
  supabase: SupabaseClient,
  orgId: string
): Promise<SubscriptionResult> {
  const { data: row, error } = await supabase
    .from("organizations")
    .select(
      "subscription_status, subscription_started_at, trial_ends_at, expires_at, subscription_plan"
    )
    .eq("id", orgId)
    .maybeSingle();

  if (error || !row) {
    return {
      allowed: false,
      status: null,
      expiresAt: null,
      trialEndsAt: null,
      startedAt: null,
      plan: "basic",
      expired: true,
      periodEndAt: null,
    };
  }

  const orgRow = row as OrgSubscriptionRow;
  const expired = isSubscriptionExpired(orgRow);
  const allowed = canWriteSubscription(orgRow);
  const periodEndAt = resolvePeriodEnd(orgRow);

  return {
    allowed,
    status: getSubscriptionStatus(orgRow),
    expiresAt: row.expires_at ?? null,
    trialEndsAt: row.trial_ends_at ?? null,
    startedAt: row.subscription_started_at ?? null,
    plan: (row.subscription_plan as SubscriptionPlan) || "basic",
    expired,
    periodEndAt,
  };
}

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
      code: "SUBSCRIPTION_EXPIRED",
      subscription_status: sub.status,
      expires_at: sub.periodEndAt,
    },
    { status: 403 }
  );
}
