-- Per-customer latest selling price per product/item (invoice suggestions)

CREATE TABLE IF NOT EXISTS customer_item_latest_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  item_reference_type text NOT NULL CHECK (item_reference_type IN ('product', 'manual')),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  item_key text,
  matching_key text NOT NULL,
  latest_price numeric(18, 2) NOT NULL CHECK (latest_price >= 0),
  last_source_invoice_item_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_item_latest_prices_ref_check CHECK (
    (
      item_reference_type = 'product'
      AND product_id IS NOT NULL
      AND item_key IS NULL
    )
    OR (
      item_reference_type = 'manual'
      AND product_id IS NULL
      AND item_key IS NOT NULL
      AND length(trim(item_key)) > 0
    )
  ),
  CONSTRAINT customer_item_latest_prices_matching_unique UNIQUE (org_id, customer_id, matching_key)
);

CREATE INDEX IF NOT EXISTS idx_customer_item_latest_prices_org_customer
  ON customer_item_latest_prices (org_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_item_latest_prices_product
  ON customer_item_latest_prices (org_id, product_id)
  WHERE product_id IS NOT NULL;

COMMENT ON TABLE customer_item_latest_prices IS 'Latest selling price per customer + product/item for invoice auto-fill.';

ALTER TABLE customer_item_latest_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members select customer_item_latest_prices"
  ON customer_item_latest_prices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = customer_item_latest_prices.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members insert customer_item_latest_prices"
  ON customer_item_latest_prices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = customer_item_latest_prices.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members update customer_item_latest_prices"
  ON customer_item_latest_prices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = customer_item_latest_prices.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members delete customer_item_latest_prices"
  ON customer_item_latest_prices FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = customer_item_latest_prices.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );
