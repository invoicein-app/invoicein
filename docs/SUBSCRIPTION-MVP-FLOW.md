# Manual Subscription MVP – Product Flow

## Design summary

### Source of truth
- **organizations** table: `org_code`, `subscription_status`, `subscription_plan`, `trial_ends_at`, `expires_at`, `subscription_started_at`.
- No new tables. Migrations already exist (`20260311000000_add_org_subscription.sql`, `20260311100000_add_org_subscription_plan.sql`).

### Business rules
1. **New org** (init-org): Gets `subscription_status = 'trial'`, `trial_ends_at` and `expires_at` = now + 1 month, `subscription_plan = 'basic'`.
2. **Expired** = `expires_at` is set and `expires_at < now()`. User can still **log in** and **view** all data. User **cannot** create/update/post/cancel/receive/adjust (write blocked in API via `requireCanWrite`).
3. **Renewal**: Manual transfer → user sends proof + **org_code** → billing admin finds org by org_code → admin extends `expires_at` and sets `subscription_status = 'active'` (and optionally updates `subscription_plan`).

### Two sides

| Side | Who | What |
|------|-----|------|
| **User** | Org member | See package, status, org_code, expiry; instructions to renew manually. |
| **Billing admin** | App-level admin (email in BILLING_ADMIN_EMAILS) | Search by org_code; see/update package, status, expiry; extend period. |

### Backend guards (already in place)
- `lib/subscription.ts`: `getSubscription(orgId)`, `requireCanWrite(orgId)`.
- All write/state-changing routes call `requireCanWrite` after resolving org_id. No additional routes to patch for Phase 4.

### Files to add/change
- **init-org**: Set `subscription_plan: 'basic'` on insert.
- **User**: New page `app/(app)/settings/subscription/page.tsx`; link from Settings home.
- **Billing admin**: `lib/billing-admin.ts` (isBillingAdmin), `app/api/admin/billing/route.ts` (GET search, PATCH update), `app/(app)/admin/billing/page.tsx`; restrict `app/api/admin/extend-subscription/route.ts` to billing admins only.
