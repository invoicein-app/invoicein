-- Multiple company bank accounts + per-invoice selection

CREATE TABLE IF NOT EXISTS company_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_holder_name text NOT NULL,
  branch text,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_bank_accounts_bank_name_nonempty CHECK (length(trim(bank_name)) > 0),
  CONSTRAINT company_bank_accounts_account_number_nonempty CHECK (length(trim(account_number)) > 0),
  CONSTRAINT company_bank_accounts_holder_nonempty CHECK (length(trim(account_holder_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_company_bank_accounts_org_active
  ON company_bank_accounts (org_id, is_active);

CREATE INDEX IF NOT EXISTS idx_company_bank_accounts_org_default
  ON company_bank_accounts (org_id, is_default)
  WHERE is_default = true;

COMMENT ON TABLE company_bank_accounts IS 'Org-scoped bank accounts for invoice payment instructions.';

ALTER TABLE company_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members select company_bank_accounts"
  ON company_bank_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = company_bank_accounts.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members insert company_bank_accounts"
  ON company_bank_accounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = company_bank_accounts.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members update company_bank_accounts"
  ON company_bank_accounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = company_bank_accounts.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members delete company_bank_accounts"
  ON company_bank_accounts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = company_bank_accounts.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES company_bank_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_bank_account_id
  ON invoices (bank_account_id)
  WHERE bank_account_id IS NOT NULL;

COMMENT ON COLUMN invoices.bank_account_id IS 'Selected company bank account for this invoice payment instructions.';

-- Backfill legacy single org bank into company_bank_accounts
INSERT INTO company_bank_accounts (
  org_id,
  bank_name,
  account_number,
  account_holder_name,
  is_active,
  is_default
)
SELECT
  o.id,
  trim(o.bank_name),
  trim(o.bank_account),
  trim(coalesce(nullif(trim(o.bank_account_name), ''), o.name, 'Rekening')),
  true,
  true
FROM organizations o
WHERE length(trim(coalesce(o.bank_name, ''))) > 0
  AND length(trim(coalesce(o.bank_account, ''))) > 0
  AND NOT EXISTS (
    SELECT 1 FROM company_bank_accounts c WHERE c.org_id = o.id
  );
