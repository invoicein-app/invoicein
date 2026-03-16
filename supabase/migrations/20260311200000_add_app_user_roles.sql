-- App-level roles: super_admin, billing_admin.
-- Used for billing admin page/API; later can drive more admin features.
-- One role per user; super_admin can do everything billing_admin can.

-- ---------------------------------------------------------------------------
-- 1) Create table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Only allowed role values
ALTER TABLE app_user_roles
  DROP CONSTRAINT IF EXISTS app_user_roles_role_check;
ALTER TABLE app_user_roles
  ADD CONSTRAINT app_user_roles_role_check
  CHECK (role IN ('super_admin', 'billing_admin'));

-- ---------------------------------------------------------------------------
-- 2) RLS: only backend (service role) should read/write; no anon access
-- ---------------------------------------------------------------------------
ALTER TABLE app_user_roles ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated: only service role can access.
-- Backend uses SUPABASE_SERVICE_ROLE_KEY to check role in lib/billing-admin.

-- ---------------------------------------------------------------------------
-- 3) Comment & index
-- ---------------------------------------------------------------------------
COMMENT ON TABLE app_user_roles IS 'App-level roles: super_admin (full), billing_admin (billing page/API). Checked in lib/billing-admin.';
COMMENT ON COLUMN app_user_roles.role IS 'super_admin | billing_admin. One role per user.';

-- Set first super_admin after migration (run in SQL Editor):
--   INSERT INTO app_user_roles (user_id, role)
--   SELECT id, 'super_admin' FROM auth.users WHERE email = 'your@email.com' LIMIT 1;
-- Add billing_admin only:
--   INSERT INTO app_user_roles (user_id, role)
--   SELECT id, 'billing_admin' FROM auth.users WHERE email = 'billing@example.com' LIMIT 1
--   ON CONFLICT (user_id) DO NOTHING;
