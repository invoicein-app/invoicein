-- Reusable manual invoice item names (separate from Master Barang / products)

CREATE TABLE IF NOT EXISTS org_manual_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  display_name text NOT NULL,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_manual_items_org_key_unique UNIQUE (org_id, item_key),
  CONSTRAINT org_manual_items_item_key_nonempty CHECK (length(trim(item_key)) > 0),
  CONSTRAINT org_manual_items_display_name_nonempty CHECK (length(trim(display_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_org_manual_items_org_last_used
  ON org_manual_items (org_id, last_used_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_manual_items_org_display_name
  ON org_manual_items (org_id, lower(display_name));

COMMENT ON TABLE org_manual_items IS 'Org-scoped catalog of manual invoice item names for autocomplete (not Master Barang).';

ALTER TABLE org_manual_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members select org_manual_items"
  ON org_manual_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = org_manual_items.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members insert org_manual_items"
  ON org_manual_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = org_manual_items.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members update org_manual_items"
  ON org_manual_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = org_manual_items.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members delete org_manual_items"
  ON org_manual_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = org_manual_items.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

-- Backfill from historical manual invoice lines (non-cancelled invoices)
INSERT INTO org_manual_items (org_id, item_key, display_name, last_used_at, updated_at)
SELECT DISTINCT ON (i.org_id, ii.item_key)
  i.org_id,
  ii.item_key,
  trim(ii.name),
  COALESCE(i.invoice_date::timestamptz, i.created_at),
  now()
FROM invoice_items ii
JOIN invoices i ON i.id = ii.invoice_id
WHERE ii.product_id IS NULL
  AND ii.item_key IS NOT NULL
  AND length(trim(ii.item_key)) > 0
  AND length(trim(ii.name)) > 0
  AND i.status IS DISTINCT FROM 'cancelled'::invoice_status
ORDER BY i.org_id, ii.item_key, COALESCE(i.invoice_date, i.created_at::date) DESC, i.created_at DESC
ON CONFLICT (org_id, item_key) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      last_used_at = GREATEST(org_manual_items.last_used_at, EXCLUDED.last_used_at),
      updated_at = now();
