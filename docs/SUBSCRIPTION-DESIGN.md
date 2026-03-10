# Manual Monthly Subscription – Design (MVP)

## Phase 1: Current state

- **Source of truth:** `organizations` table (id, name, org_code, …). Used everywhere via `memberships.org_id` → organizations.
- **org_code:** Already present; created in `init-org` with unique code, shown in navbar and staff settings.
- **Org creation:** Only path is `POST /api/init-org` (after login); creates one org + one membership. No other signup path creates orgs.

## Proposed design

### 1. Database

- **Option A (chosen):** Add subscription columns on `organizations` to keep checks simple and avoid extra joins.
- **Columns:**
  - `subscription_status` — enum: `trial` | `active` | `grace_period` | `expired` | `cancelled`
  - `trial_ends_at` — timestamptz, end of free trial
  - `expires_at` — timestamptz, end of current billing period (used for “can write” rule)

- **Rule:** Org is **allowed to create/write** iff `expires_at IS NULL OR expires_at > now()`.
- **Existing orgs:** Backfill `subscription_status = 'active'`, `trial_ends_at = now()`, `expires_at = now() + interval '1 month'` (or leave `expires_at` null to mean “legacy, always allowed” – we use null = allow for backward compatibility, so backfill `expires_at = null` and `subscription_status = 'active'` for existing orgs).

Actually per requirement: “If subscription is expired, user can view but not create.” So we need a clear cutoff. So:
- **Existing orgs:** Set `subscription_status = 'active'`, `trial_ends_at = created_at + 1 month` (or now + 1 month), `expires_at = null` to mean “no expiry” for legacy, OR set `expires_at = now() + 1 month` so they get one month from migration. Simplest for MVP: backfill `expires_at = null` and treat `null` as “allowed” (legacy). New orgs get trial and then require extension.
- **New orgs (init-org):** Set `subscription_status = 'trial'`, `trial_ends_at = now() + 1 month`, `expires_at = trial_ends_at`. When admin extends: set `expires_at = (expires_at or now()) + 1 month`, `subscription_status = 'active'`.

### 2. org_code

- Already exists and is used for staff login and display. No change except ensure it’s visible where needed (navbar done; optional: settings subscription section).

### 3. Subscription flow (manual)

- Customer pays manually → sends proof + **org_code** → admin finds org by org_code → admin runs “extend 1 month” (e.g. future API or Supabase dashboard update).
- Extend logic: `expires_at = greatest(expires_at, now()) + interval '1 month'`, `subscription_status = 'active'`.

### 4. Access rule

- **Read / view:** Always allowed (including expired).
- **Write / state-changing:** Allowed only if `expires_at IS NULL OR expires_at > now()`.
- Enforced in API routes that perform creates/updates/deletes/post/cancel/receive/adjust.

### 5. Statuses (for display/audit)

- `trial` — in free trial (expires_at = trial_ends_at).
- `active` — paid, expires_at in the future.
- `grace_period` — optional; could be “expires_at passed but grace until X”; MVP we can skip or set when expires_at < now() and we allow a few days.
- `expired` — expires_at < now(); no writes.
- `cancelled` — admin disabled; no writes (optional, can treat same as expired).

Implementation: one reusable helper that, given `orgId`, returns `{ allowed: boolean, status?, expiresAt? }` by reading from `organizations`. Use in every write route after auth.

---

## Phase 2: SQL migration

See `supabase/migrations/YYYYMMDD_add_org_subscription.sql` (or inline below).

## Phase 3: Routes to guard (write / state-changing)

| File | Method / handler |
|------|-------------------|
| `app/api/invoice/create/route.ts` | POST |
| `app/api/invoice/[id]/route.ts` | PATCH, DELETE |
| `app/api/invoice/[id]/sent/route.ts` | POST |
| `app/api/invoice/cancel/route.ts` | POST |
| `app/api/invoice/create-delivery-note/route.ts` | POST |
| `app/api/invoice/payments/[invoiceId]/route.ts` | POST |
| `app/api/invoice/add-payment/route.ts` | POST |
| `app/api/invoice/payment/[paymentId]/route.ts` | PATCH, DELETE |
| `app/api/quotations/create/route.ts` | POST |
| `app/api/quotations/update/[id]/route.ts` | PATCH |
| `app/api/quotations/delete/[id]/route.ts` | DELETE |
| `app/api/purchase-orders/create/route.ts` | POST |
| `app/api/purchase-orders/[id]/route.ts` | PATCH, DELETE |
| `app/api/purchase-orders/[id]/delete/route.ts` | POST |
| `app/api/purchase-orders/[id]/receive/route.ts` | POST |
| `app/api/purchase-orders/[id]/send/route.ts` | POST |
| `app/api/purchase-orders/[id]/cancel/route.ts` | POST |
| `app/api/purchase-orders/[id]/grn/route.ts` | POST |
| `app/api/delivery-notes/[id]/post/route.ts` | POST |
| `app/api/delivery-notes/[id]/cancel/route.ts` | POST |
| `app/api/delivery-notes/from-invoice/[invoiceId]/route.ts` | POST (if exists) |
| `app/api/products/route.ts` | POST, PATCH, DELETE |
| `app/api/vendors/create/route.ts` | POST |
| `app/api/vendors/[id]/route.ts` | PATCH (and deactivate) |
| `app/api/warehouses/route.ts` | POST |
| `app/api/warehouses/[id]/route.ts` | PATCH, DELETE |
| `app/api/warehouses/[id]/stock-adjust/route.ts` | POST |
| `app/api/org/profile/route.ts` | POST |
| `app/api/org/logo/route.ts` | POST |
| `app/api/members/create-staff/route.ts` | POST |
| `app/api/members/delete-staff/route.ts` | POST/DELETE |
| `app/api/members/set-active/route.ts` | POST |
| `app/api/auth/invoices/[id]/route.ts` | PATCH |
| `app/api/auth/invoices/update/route.ts` | POST |
| `app/api/invoices/[id]/route.ts` | PATCH |

Init-org: no guard; set trial + expires_at on insert.

Read-only or non–state-changing: GET list/detail, PDF generate (read), auth/invoices GET, etc. — no guard.

## Phase 4: Reusable helper

- `lib/check-subscription.ts` (or `lib/subscription.ts`): `getSubscription(orgId)` → `{ allowed, status, expiresAt }`; optional `requireCanWrite(orgId)` that returns error response if not allowed. Use `requireCanWrite` in each write route after resolving org_id from membership.

## Phase 5: UI

- Navbar: already shows org_code (and role). Optionally show subscription status (e.g. “Trial until …” / “Active” / “Expired”).
- Settings: section “Subscription” with org_code (copyable), status, expires_at, and note “Bayar manual lalu kirim bukti + kode org ke admin.”
- Admin: later, simple page or script to find org by org_code and extend expires_at (can be Supabase SQL or small internal API).

---

## Summary

- **Schema:** Add `subscription_status`, `trial_ends_at`, `expires_at` to `organizations`. Backfill existing rows; new orgs get trial in init-org.
- **Guard:** One helper; call in all write/state-changing API routes.
- **Manual ops:** Admin finds org by org_code, extends by setting `expires_at` (and status = active). No online payment in MVP.
