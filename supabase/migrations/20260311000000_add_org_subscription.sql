-- Manual monthly subscription: organizations subscription fields + org_code as operational identifier.
-- Run in Supabase SQL Editor or via supabase db push.
-- Compatible with existing app; manual billing only; no online payments.

-- ---------------------------------------------------------------------------
-- 1) Add columns
-- ---------------------------------------------------------------------------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS org_code text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2) org_code: unique operational identifier (customer sends proof + org_code to admin)
-- ---------------------------------------------------------------------------
-- Backfill existing rows that have no org_code (one unique value per row, from id)
UPDATE organizations
SET org_code = 'ORG' || UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 10))
WHERE org_code IS NULL OR org_code = '';

-- Unique constraint: one org_code per organization (customers send proof + org_code to admin)
-- Drop both constraint and index so re-running this migration does not fail (relation already exists)
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_org_code_key;
DROP INDEX IF EXISTS organizations_org_code_key;
ALTER TABLE organizations
  ADD CONSTRAINT organizations_org_code_key UNIQUE (org_code);

-- ---------------------------------------------------------------------------
-- 3) subscription_status: allowed values only
-- ---------------------------------------------------------------------------
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_subscription_status_check;
ALTER TABLE organizations
  ADD CONSTRAINT organizations_subscription_status_check
  CHECK (
    subscription_status IS NULL
    OR subscription_status IN ('trial', 'active', 'grace_period', 'expired', 'cancelled')
  );

-- ---------------------------------------------------------------------------
-- 4) Backfill existing organizations (legacy = active, no expiry so they keep access)
-- ---------------------------------------------------------------------------
UPDATE organizations
SET
  subscription_status     = COALESCE(subscription_status, 'active'),
  subscription_started_at = COALESCE(subscription_started_at, created_at, now()),
  trial_ends_at           = COALESCE(trial_ends_at, COALESCE(created_at, now()) + interval '1 month')
WHERE subscription_status IS NULL;

-- Do not set expires_at for existing orgs: leave NULL so they remain allowed (legacy).
-- New orgs get trial in app (init-org): subscription_started_at = now(), trial_ends_at = now() + 1 month, expires_at = trial_ends_at.

-- ---------------------------------------------------------------------------
-- 5) Comments
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN organizations.org_code IS 'Unique code for this org; customers send proof of transfer + org_code to admin for manual subscription extension.';
COMMENT ON COLUMN organizations.subscription_status IS 'trial | active | grace_period | expired | cancelled. Used with expires_at for write access.';
COMMENT ON COLUMN organizations.subscription_started_at IS 'When the current subscription period (trial or paid) started; for traceability.';
COMMENT ON COLUMN organizations.trial_ends_at IS 'End of free trial. New orgs set in init-org; legacy backfilled from created_at + 1 month.';
COMMENT ON COLUMN organizations.expires_at IS 'End of current billing period. NULL = legacy allowed. When expires_at < now(), org can view but not create/update/post/cancel/receive (write blocked in app).';
