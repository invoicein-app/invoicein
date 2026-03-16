/**
 * Billing admin access control.
 *
 * Access is determined by:
 * 1) Database: app_user_roles.role in ('super_admin', 'billing_admin') for the user.
 * 2) Fallback: env BILLING_ADMIN_EMAILS (comma-separated) for migration/backward compatibility.
 *
 * All checks go through this module; no env or role checks elsewhere.
 */

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

/** User-like object with at least email (e.g. from auth.getUser()). */
export type UserLike = { email?: string | null; id?: string };

export type BillingAdminAuthResult =
  | { ok: true; user: { id: string; email: string | null } }
  | { ok: false; status: 401 | 403; error: string };

/** Allowed app roles for billing admin access. */
const BILLING_ALLOWED_ROLES = ["super_admin", "billing_admin"] as const;

// ---------------------------------------------------------------------------
// Access check: DB role first, then env fallback
// ---------------------------------------------------------------------------

/**
 * Whether this user is allowed to access billing admin (search orgs, extend subscription, etc.).
 * Sync version: checks env allowlist only. Use getBillingAdminAuth() in routes/pages for full DB + env check.
 */
export function canAccessBillingAdmin(user: UserLike | null | undefined): boolean {
  if (!user) return false;
  const email = typeof (user as any).email === "string" ? (user as any).email : null;
  if (!email) return false;
  return allowlistFromEnv().includes(email.trim().toLowerCase());
}

/**
 * Check billing admin access: first app_user_roles in DB (super_admin, billing_admin), then env allowlist.
 * Used by getBillingAdminAuth. Requires service role to read app_user_roles (RLS blocks anon).
 */
async function checkBillingAdminAccess(userId: string, email: string | null): Promise<boolean> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (key && url) {
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await admin
      .from("app_user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    const role = (data as { role?: string } | null)?.role;
    if (role && BILLING_ALLOWED_ROLES.includes(role as any)) return true;
  }
  if (email) return allowlistFromEnv().includes(email.trim().toLowerCase());
  return false;
}

/** Convenience: check by email only (env only). Prefer getBillingAdminAuth() for full check. */
export function isBillingAdmin(email: string | null | undefined): boolean {
  return canAccessBillingAdmin({ email });
}

/** Env fallback; also used when service role is not set. Do not use elsewhere. */
function allowlistFromEnv(): string[] {
  return (process.env.BILLING_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Server-side auth helper: get current user and enforce billing admin access
// ---------------------------------------------------------------------------

/**
 * Use in API routes and server-rendered pages that need billing admin access.
 * Gets the current user from cookies, then checks DB (app_user_roles) and env fallback.
 *
 * Usage in route handlers:
 *   const auth = await getBillingAdminAuth(cookieStore);
 *   if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
 *
 * Usage in server pages:
 *   const auth = await getBillingAdminAuth(cookieStore);
 *   if (!auth.ok) redirect(auth.status === 401 ? "/login" : "/dashboard");
 */
export async function getBillingAdminAuth(
  cookieStore: { getAll: () => { name: string; value: string }[]; set: (name: string, value: string, options?: any) => void }
): Promise<BillingAdminAuthResult> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: any }[]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const email = (user as any)?.email ?? null;
  const allowed = await checkBillingAdminAccess(user.id, email);
  if (!allowed) {
    return { ok: false, status: 403, error: "Akses hanya untuk billing admin." };
  }

  return {
    ok: true,
    user: { id: user.id, email },
  };
}
