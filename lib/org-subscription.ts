/**
 * Initialize / backfill organization subscription fields (service role).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addDaysIso,
  buildNewOrgSubscriptionFields,
  getTrialDays,
  isSubscriptionExpired,
  type OrgSubscriptionRow,
} from "@/lib/subscription";

export type EnsureOrgSubscriptionResult = {
  updated: boolean;
  orgId: string;
};

/**
 * Ensures org has trial/subscription dates. Fills only missing fields.
 * Uses org created_at (or now) as period start when backfilling.
 */
export async function ensureOrgSubscription(
  admin: SupabaseClient,
  orgId: string
): Promise<EnsureOrgSubscriptionResult> {
  const { data: row, error } = await admin
    .from("organizations")
    .select(
      "id, created_at, subscription_status, subscription_started_at, trial_ends_at, expires_at, subscription_plan"
    )
    .eq("id", orgId)
    .maybeSingle();

  if (error || !row) {
    return { updated: false, orgId };
  }

  const needsBackfill =
    !row.subscription_status ||
    !row.expires_at ||
    !row.trial_ends_at ||
    !row.subscription_started_at;

  if (!needsBackfill) {
    return { updated: false, orgId };
  }

  const startSource =
    row.subscription_started_at || row.created_at || new Date().toISOString();
  const start = new Date(startSource);
  const trialFields = buildNewOrgSubscriptionFields(start);

  const trialEnd = row.trial_ends_at || trialFields.trial_ends_at;
  const expiresAt = row.expires_at || trialFields.expires_at;
  const startedAt = row.subscription_started_at || trialFields.subscription_started_at;

  const merged: OrgSubscriptionRow = {
    subscription_status: row.subscription_status,
    subscription_started_at: startedAt,
    trial_ends_at: trialEnd,
    expires_at: expiresAt,
    subscription_plan: row.subscription_plan,
  };

  let status = row.subscription_status || trialFields.subscription_status;
  if (isSubscriptionExpired(merged)) {
    status = "expired";
  } else if (!row.subscription_status) {
    status = "trial";
  }

  const { error: upErr } = await admin
    .from("organizations")
    .update({
      subscription_status: status,
      subscription_started_at: startedAt,
      trial_ends_at: trialEnd,
      expires_at: expiresAt,
      subscription_plan: row.subscription_plan || "basic",
    })
    .eq("id", orgId);

  if (upErr) {
    throw upErr;
  }

  return { updated: true, orgId };
}

export { getTrialDays, buildNewOrgSubscriptionFields, addDaysIso };
