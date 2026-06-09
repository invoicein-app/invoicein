-- Roll back a document counter when create fails after allocation (no document persisted).

CREATE OR REPLACE FUNCTION release_document_sequence(
  p_org_id uuid,
  p_doc_type text,
  p_period_key text,
  p_sequence integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated integer;
BEGIN
  IF p_sequence IS NULL OR p_sequence < 1 THEN
    RETURN false;
  END IF;

  UPDATE document_counters
  SET
    last_number = last_number - 1,
    updated_at = now()
  WHERE org_id = p_org_id
    AND doc_type = p_doc_type
    AND period_key = p_period_key
    AND last_number = p_sequence
    AND last_number > 0;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION release_document_sequence(uuid, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION release_document_sequence(uuid, text, text, integer) TO authenticated, service_role;
