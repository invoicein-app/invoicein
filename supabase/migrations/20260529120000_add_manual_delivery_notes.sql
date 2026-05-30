-- Manual Surat Jalan: SJ without invoice + customer snapshot on delivery_notes

ALTER TABLE delivery_notes
  ALTER COLUMN invoice_id DROP NOT NULL;

ALTER TABLE delivery_notes
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text;

UPDATE delivery_notes dn
SET
  customer_name = COALESCE(NULLIF(trim(dn.customer_name), ''), i.customer_name, ''),
  customer_phone = COALESCE(NULLIF(trim(dn.customer_phone), ''), i.customer_phone)
FROM invoices i
WHERE dn.invoice_id = i.id
  AND (dn.customer_name IS NULL OR trim(dn.customer_name) = '');

UPDATE delivery_notes
SET customer_name = COALESCE(customer_name, '')
WHERE customer_name IS NULL;

ALTER TABLE delivery_notes
  ALTER COLUMN customer_name SET DEFAULT '',
  ALTER COLUMN customer_name SET NOT NULL;

-- At most one SJ per invoice per org (manual SJ keeps invoice_id NULL)
DROP INDEX IF EXISTS delivery_notes_org_invoice_uniq;
CREATE UNIQUE INDEX delivery_notes_org_invoice_uniq
  ON delivery_notes (org_id, invoice_id)
  WHERE invoice_id IS NOT NULL;
