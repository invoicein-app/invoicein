-- Remember satuan for manual invoice item suggestions

ALTER TABLE org_manual_items
  ADD COLUMN IF NOT EXISTS unit text;

COMMENT ON COLUMN org_manual_items.unit IS 'Last-used unit for manual invoice item autocomplete.';

-- Backfill from most recent manual invoice line per org + item_key
UPDATE org_manual_items o
SET unit = sub.unit
FROM (
  SELECT DISTINCT ON (i.org_id, ii.item_key)
    i.org_id,
    ii.item_key,
    trim(ii.unit) AS unit
  FROM invoice_items ii
  JOIN invoices i ON i.id = ii.invoice_id
  WHERE ii.product_id IS NULL
    AND ii.item_key IS NOT NULL
    AND length(trim(ii.item_key)) > 0
    AND ii.unit IS NOT NULL
    AND length(trim(ii.unit)) > 0
    AND i.status IS DISTINCT FROM 'cancelled'::invoice_status
  ORDER BY i.org_id, ii.item_key, COALESCE(i.invoice_date, i.created_at::date) DESC, i.created_at DESC
) sub
WHERE o.org_id = sub.org_id
  AND o.item_key = sub.item_key
  AND (o.unit IS NULL OR length(trim(o.unit)) = 0);
