-- Recurring expense templates: daily / weekly / monthly + weekday for weekly

ALTER TABLE expense_recurring_templates
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'monthly';

ALTER TABLE expense_recurring_templates
  ADD COLUMN IF NOT EXISTS due_day_of_week smallint;

ALTER TABLE expense_recurring_templates
  ALTER COLUMN due_day_of_month DROP NOT NULL;

UPDATE expense_recurring_templates
SET frequency = 'monthly'
WHERE frequency IS NULL OR frequency = '';

ALTER TABLE expense_recurring_templates
  DROP CONSTRAINT IF EXISTS expense_recurring_templates_frequency_check;

ALTER TABLE expense_recurring_templates
  ADD CONSTRAINT expense_recurring_templates_frequency_check
  CHECK (frequency IN ('daily', 'weekly', 'monthly'));

ALTER TABLE expense_recurring_templates
  DROP CONSTRAINT IF EXISTS expense_recurring_templates_due_day_of_week_check;

ALTER TABLE expense_recurring_templates
  ADD CONSTRAINT expense_recurring_templates_due_day_of_week_check
  CHECK (due_day_of_week IS NULL OR (due_day_of_week >= 1 AND due_day_of_week <= 7));

COMMENT ON COLUMN expense_recurring_templates.frequency IS 'daily | weekly | monthly';
COMMENT ON COLUMN expense_recurring_templates.due_day_of_week IS 'ISO weekday 1=Senin … 7=Minggu; required when frequency=weekly';
