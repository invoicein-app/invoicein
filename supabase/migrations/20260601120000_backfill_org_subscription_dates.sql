-- Backfill orgs missing subscription dates (stop "free forever" when expires_at IS NULL).
-- Trial length matches app default: 30 days from org created_at (adjust via SUBSCRIPTION_TRIAL_DAYS in app for new orgs).

UPDATE organizations
SET
  subscription_status = COALESCE(subscription_status, 'trial'),
  subscription_started_at = COALESCE(subscription_started_at, created_at, now()),
  trial_ends_at = COALESCE(
    trial_ends_at,
    COALESCE(subscription_started_at, created_at, now()) + interval '30 days'
  ),
  expires_at = COALESCE(
    expires_at,
    COALESCE(trial_ends_at, COALESCE(subscription_started_at, created_at, now()) + interval '30 days')
  )
WHERE
  subscription_status IS NULL
  OR subscription_started_at IS NULL
  OR trial_ends_at IS NULL
  OR expires_at IS NULL;

-- Mark clearly expired orgs
UPDATE organizations
SET subscription_status = 'expired'
WHERE
  expires_at IS NOT NULL
  AND expires_at < now()
  AND COALESCE(subscription_status, '') NOT IN ('cancelled', 'expired');
