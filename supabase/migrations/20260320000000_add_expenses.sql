-- Operational expenses (UMKM): manual transactions + recurring monthly templates

CREATE TABLE IF NOT EXISTS expense_recurring_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  default_amount numeric(18,2) NOT NULL CHECK (default_amount >= 0),
  due_day_of_month integer NOT NULL CHECK (due_day_of_month >= 1 AND due_day_of_month <= 31),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expense_date date NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  payment_status text NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'unpaid')),
  payment_method text,
  notes text,
  recurring_template_id uuid REFERENCES expense_recurring_templates(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_org_date ON expenses(org_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_org_status ON expenses(org_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_expenses_recurring_template ON expenses(org_id, recurring_template_id)
  WHERE recurring_template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expense_recurring_templates_org ON expense_recurring_templates(org_id);

COMMENT ON TABLE expenses IS 'Operational expense transactions per organization.';
COMMENT ON TABLE expense_recurring_templates IS 'Monthly recurring expense templates (gaji, wifi, sewa, etc.).';

-- RLS: active org members
ALTER TABLE expense_recurring_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members select expense_recurring_templates"
  ON expense_recurring_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = expense_recurring_templates.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members insert expense_recurring_templates"
  ON expense_recurring_templates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = expense_recurring_templates.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members update expense_recurring_templates"
  ON expense_recurring_templates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = expense_recurring_templates.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members delete expense_recurring_templates"
  ON expense_recurring_templates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = expense_recurring_templates.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members select expenses"
  ON expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = expenses.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members insert expenses"
  ON expenses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = expenses.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members update expenses"
  ON expenses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = expenses.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members delete expenses"
  ON expenses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = expenses.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );
