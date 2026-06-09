-- PO PDF display settings per organization

CREATE TABLE IF NOT EXISTS po_settings (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  show_warehouse_name boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE po_settings IS 'Per-org PO PDF options (e.g. show warehouse name in ship-to).';

ALTER TABLE po_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members select po_settings"
  ON po_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = po_settings.organization_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members insert po_settings"
  ON po_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = po_settings.organization_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE POLICY "Members update po_settings"
  ON po_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = po_settings.organization_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

CREATE OR REPLACE FUNCTION set_po_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_po_settings_updated_at ON po_settings;
CREATE TRIGGER trg_po_settings_updated_at
BEFORE UPDATE ON po_settings
FOR EACH ROW
EXECUTE FUNCTION set_po_settings_updated_at();
