-- Staff limits by subscription plan: basic => 1 staff, standard => 3 staff.
-- Plan is stored on organizations; limit enforced in app when creating staff.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS subscription_plan text;

-- Allow only 'basic' | 'standard'; default 'basic'
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_subscription_plan_check;
ALTER TABLE organizations
  ADD CONSTRAINT organizations_subscription_plan_check
  CHECK (
    subscription_plan IS NULL
    OR subscription_plan IN ('basic', 'standard')
  );

-- Existing orgs default to basic
UPDATE organizations
SET subscription_plan = COALESCE(subscription_plan, 'basic')
WHERE subscription_plan IS NULL;

COMMENT ON COLUMN organizations.subscription_plan IS 'basic => max 1 active staff, standard => max 3 active staff. Count: role=staff AND is_active=true.';
