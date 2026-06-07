-- Personal bookkeeping workflow: per-invoice flag + per-user UI preference.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS bookkeeping_recorded boolean NOT NULL DEFAULT false;

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS show_invoice_bookkeeping_status boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN invoices.bookkeeping_recorded IS
  'Personal workflow flag: invoice recorded in external bookkeeping. Not payment status.';

COMMENT ON COLUMN memberships.show_invoice_bookkeeping_status IS
  'User preference: show Pencatatan column/toggle on invoice list.';
