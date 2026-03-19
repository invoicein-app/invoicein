-- Payment confirmation flow: user submits transfer details; admin reviews and marks confirmed/rejected.
-- See docs/PAYMENT-CONFIRMATION-FLOW.md.

-- ---------------------------------------------------------------------------
-- 1) Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_package text NOT NULL,
  sender_account_name text NOT NULL,
  sender_bank text NOT NULL,
  sender_account_number text NOT NULL,
  transfer_amount text NOT NULL,
  transfer_date date NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE payment_confirmations
  DROP CONSTRAINT IF EXISTS payment_confirmations_target_package_check;
ALTER TABLE payment_confirmations
  ADD CONSTRAINT payment_confirmations_target_package_check
  CHECK (target_package IN ('basic', 'standard'));

ALTER TABLE payment_confirmations
  DROP CONSTRAINT IF EXISTS payment_confirmations_status_check;
ALTER TABLE payment_confirmations
  ADD CONSTRAINT payment_confirmations_status_check
  CHECK (status IN ('pending', 'confirmed', 'rejected'));

-- ---------------------------------------------------------------------------
-- 2) RLS: user can insert for own org; user can read own org's rows; admin uses service role
-- ---------------------------------------------------------------------------
ALTER TABLE payment_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert for own org"
  ON payment_confirmations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = payment_confirmations.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Users can read own org confirmations"
  ON payment_confirmations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = payment_confirmations.org_id
        AND m.user_id = auth.uid()
    )
  );

-- No UPDATE policy for authenticated users; only service role (admin API) updates status.

-- ---------------------------------------------------------------------------
-- 3) Index + comment
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS payment_confirmations_org_id_idx ON payment_confirmations(org_id);
CREATE INDEX IF NOT EXISTS payment_confirmations_status_created_idx ON payment_confirmations(status, created_at DESC);

COMMENT ON TABLE payment_confirmations IS 'User-submitted payment confirmations for subscription renewal; admin reviews from Billing Admin.';
