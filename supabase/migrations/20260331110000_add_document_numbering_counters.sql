-- Document numbering settings + yearly counters (concurrency-safe)

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS public_document_code text NULL,
  ADD COLUMN IF NOT EXISTS invoice_prefix text NOT NULL DEFAULT 'INV',
  ADD COLUMN IF NOT EXISTS po_prefix text NOT NULL DEFAULT 'PO',
  ADD COLUMN IF NOT EXISTS quotation_prefix text NOT NULL DEFAULT 'QUO',
  ADD COLUMN IF NOT EXISTS numbering_reset_type text NOT NULL DEFAULT 'yearly';

UPDATE organizations
SET
  invoice_prefix = COALESCE(NULLIF(upper(trim(invoice_prefix)), ''), 'INV'),
  po_prefix = COALESCE(NULLIF(upper(trim(po_prefix)), ''), 'PO'),
  quotation_prefix = COALESCE(NULLIF(upper(trim(quotation_prefix)), ''), 'QUO'),
  public_document_code = NULLIF(upper(trim(public_document_code)), ''),
  numbering_reset_type = 'yearly';

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_numbering_reset_type_check;
ALTER TABLE organizations
  ADD CONSTRAINT organizations_numbering_reset_type_check
  CHECK (numbering_reset_type IN ('yearly'));

CREATE TABLE IF NOT EXISTS document_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  period_key text NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_counters_doc_type_check
    CHECK (doc_type IN ('invoice', 'purchase_order', 'quotation')),
  CONSTRAINT document_counters_period_key_check
    CHECK (period_key ~ '^[0-9]{4}$'),
  CONSTRAINT document_counters_last_number_check
    CHECK (last_number >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS document_counters_org_doc_period_uniq
  ON document_counters (org_id, doc_type, period_key);

CREATE OR REPLACE FUNCTION set_document_counters_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_counters_updated_at ON document_counters;
CREATE TRIGGER trg_document_counters_updated_at
BEFORE UPDATE ON document_counters
FOR EACH ROW
EXECUTE FUNCTION set_document_counters_updated_at();

CREATE OR REPLACE FUNCTION next_document_sequence(
  p_org_id uuid,
  p_doc_type text,
  p_period_key text
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO document_counters (org_id, doc_type, period_key, last_number)
  VALUES (p_org_id, p_doc_type, p_period_key, 1)
  ON CONFLICT (org_id, doc_type, period_key)
  DO UPDATE
    SET last_number = document_counters.last_number + 1,
        updated_at = now()
  RETURNING last_number;
$$;

REVOKE ALL ON FUNCTION next_document_sequence(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION next_document_sequence(uuid, text, text) TO authenticated, service_role;
