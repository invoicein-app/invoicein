-- Fix SJ numbering: use sj_date (not today) and remove duplicate insert trigger.

DROP TRIGGER IF EXISTS trg_set_delivery_note_number ON public.delivery_notes;

CREATE OR REPLACE FUNCTION public.next_document_number_for_date(
  p_doc_type text,
  p_document_date date
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_date text;
  v_next int;
  v_prefix text;
  v_max_existing int;
BEGIN
  v_org := public.current_org_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'No organization found for this user.';
  END IF;

  v_date := to_char(
    coalesce(p_document_date, (now() AT TIME ZONE 'Asia/Jakarta')::date),
    'YYYYMMDD'
  );

  IF p_doc_type = 'invoice' THEN
    v_prefix := 'INV';
  ELSIF p_doc_type = 'delivery_note' THEN
    v_prefix := 'SJ';
  ELSE
    RAISE EXCEPTION 'Invalid doc_type: %', p_doc_type;
  END IF;

  SELECT coalesce(max((regexp_match(sj_number, '-(\d{4})$'))[1]::int), 0)
  INTO v_max_existing
  FROM public.delivery_notes
  WHERE sj_number LIKE v_prefix || '-' || v_date || '-%';

  INSERT INTO public.doc_counters(org_id, doc_type, yyyymmdd, last_number)
  VALUES (v_org, p_doc_type, v_date, 0)
  ON CONFLICT (org_id, doc_type, yyyymmdd) DO NOTHING;

  UPDATE public.doc_counters
  SET last_number = last_number + 1
  WHERE org_id = v_org
    AND doc_type = p_doc_type
    AND yyyymmdd = v_date
  RETURNING last_number INTO v_next;

  v_next := greatest(v_next, v_max_existing + 1);

  UPDATE public.doc_counters
  SET last_number = v_next
  WHERE org_id = v_org
    AND doc_type = p_doc_type
    AND yyyymmdd = v_date
    AND last_number < v_next;

  RETURN v_prefix || '-' || v_date || '-' || lpad(v_next::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_document_number_for_date(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_document_number_for_date(text, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_dn_autonumber()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new.sj_date IS NULL THEN
    new.sj_date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  END IF;

  IF new.sj_number IS NULL OR new.sj_number = '' THEN
    new.sj_number := public.next_document_number_for_date('delivery_note', new.sj_date);
  END IF;

  IF new.org_id IS NULL THEN
    new.org_id := public.current_org_id();
  END IF;

  IF new.created_by IS NULL THEN
    new.created_by := auth.uid();
  END IF;

  RETURN new;
END;
$$;
