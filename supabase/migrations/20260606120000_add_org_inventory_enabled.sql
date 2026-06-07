-- Toggle inventory/warehouse workflow: when OFF, invoice items may be manual text.

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS inventory_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN org_settings.inventory_enabled IS
  'When true, invoice items must link to master products for stock tracking.';
