-- Subscription change history: record when admin updates package or expires_at from Billing Admin.
-- Read-only for audit; only backend (service role) inserts.

CREATE TABLE IF NOT EXISTS subscription_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  org_code text NOT NULL,
  previous_plan text,
  new_plan text,
  previous_expires_at timestamptz,
  new_expires_at timestamptz,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz DEFAULT now() NOT NULL,
  note text
);

CREATE INDEX IF NOT EXISTS subscription_history_org_id_idx ON subscription_history(org_id);
CREATE INDEX IF NOT EXISTS subscription_history_changed_at_idx ON subscription_history(changed_at DESC);

COMMENT ON TABLE subscription_history IS 'Audit log: admin changes to org subscription (plan, expires_at) from Billing Admin.';
