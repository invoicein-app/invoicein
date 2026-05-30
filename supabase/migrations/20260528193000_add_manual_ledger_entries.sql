-- Manual receivable/payable entries (hybrid with invoice-derived receivables)

CREATE TABLE IF NOT EXISTS manual_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('receivable', 'payable')),
  entry_date date NOT NULL,
  party_source_type text NOT NULL DEFAULT 'other' CHECK (party_source_type IN ('customer', 'vendor', 'other')),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  party_name text NOT NULL,
  description text NOT NULL,
  total_amount numeric(18,2) NOT NULL CHECK (total_amount >= 0),
  paid_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  due_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_ledger_entries_org_type_date
  ON manual_ledger_entries(org_id, entry_type, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_manual_ledger_entries_org_due
  ON manual_ledger_entries(org_id, due_date)
  WHERE due_date IS NOT NULL;

COMMENT ON TABLE manual_ledger_entries IS 'Manual receivable/payable records outside invoice/vendor formal flows.';

ALTER TABLE manual_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members select manual_ledger_entries"
  ON manual_ledger_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = manual_ledger_entries.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members insert manual_ledger_entries"
  ON manual_ledger_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = manual_ledger_entries.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members update manual_ledger_entries"
  ON manual_ledger_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = manual_ledger_entries.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members delete manual_ledger_entries"
  ON manual_ledger_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = manual_ledger_entries.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );
