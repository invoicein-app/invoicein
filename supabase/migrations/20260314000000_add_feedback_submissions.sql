-- User feedback inbox (Kritik & Masukan)
-- MVP: user submits from any page; admin reviews and updates status.

CREATE TABLE IF NOT EXISTS feedback_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  org_code text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  category text NOT NULL,
  message text NOT NULL,
  current_route text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Constraints
ALTER TABLE feedback_submissions
  DROP CONSTRAINT IF EXISTS feedback_submissions_category_check;
ALTER TABLE feedback_submissions
  ADD CONSTRAINT feedback_submissions_category_check
  CHECK (category IN ('bug', 'saran', 'pertanyaan', 'keluhan'));

ALTER TABLE feedback_submissions
  DROP CONSTRAINT IF EXISTS feedback_submissions_status_check;
ALTER TABLE feedback_submissions
  ADD CONSTRAINT feedback_submissions_status_check
  CHECK (status IN ('new', 'read', 'processed', 'done'));

-- RLS
ALTER TABLE feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Users can insert feedback for their own org
CREATE POLICY "Users can insert feedback for own org"
  ON feedback_submissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM memberships m
      WHERE m.org_id = feedback_submissions.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

-- Admins can read feedback for their org
CREATE POLICY "Org admin can read feedback"
  ON feedback_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM memberships m
      WHERE m.org_id = feedback_submissions.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
        AND m.role = 'admin'
    )
  );

-- Admins can update feedback status
CREATE POLICY "Org admin can update feedback"
  ON feedback_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM memberships m
      WHERE m.org_id = feedback_submissions.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
        AND m.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM memberships m
      WHERE m.org_id = feedback_submissions.org_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
        AND m.role = 'admin'
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS feedback_submissions_org_id_idx ON feedback_submissions(org_id);
CREATE INDEX IF NOT EXISTS feedback_submissions_status_created_idx ON feedback_submissions(status, created_at DESC);

COMMENT ON TABLE feedback_submissions IS 'Kritik & Masukan MVP: user submits feedback; org admin reviews and updates status.';

