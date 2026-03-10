// ===============================
// 1) FULL REPLACE: app/components/navbar.tsx
// Topbar ringkas: Brand + org/role + logout
// ===============================
export const runtime = "nodejs";

import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function isAdminRole(role: string) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "owner" || r === "super_admin";
}

export default async function Navbar() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
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
  const user = userRes.user;

  // belum login
  if (!user) {
    return (
      <div style={wrap()}>
        <div style={inner()}>
          <Link href="/dashboard" style={brand()}>
            InvoiceKu
          </Link>

          <div style={{ marginLeft: "auto", flexShrink: 0 }}>
            <Link href="/login" style={btnPrimary()}>
              Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("role, organizations:organizations(name, org_code, subscription_status, trial_ends_at, expires_at)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const orgName = (membership as any)?.organizations?.name || "";
  const orgCode = (membership as any)?.organizations?.org_code || "";
  const subStatus = (membership as any)?.organizations?.subscription_status || "";
  const trialEndsAt = (membership as any)?.organizations?.trial_ends_at || "";
  const expiresAt = (membership as any)?.organizations?.expires_at || "";
  const role = (membership as any)?.role || "";
  const isAdmin = isAdminRole(role);
  const roleDisplay = role ? String(role).charAt(0).toUpperCase() + String(role).slice(1).toLowerCase() : "—";

  const now = new Date();
  const periodEndRaw = expiresAt || trialEndsAt;
  const endDate = periodEndRaw ? new Date(periodEndRaw) : null;
  const expired = endDate ? endDate <= now : false;
  const daysLeft =
    endDate === null
      ? null
      : expired
        ? 0
        : Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  const subLabel =
    expired
      ? "Kadaluarsa"
      : subStatus === "trial"
        ? "Trial"
        : subStatus === "active"
          ? "Aktif"
          : subStatus || "—";
  const expiresLabel =
    periodEndRaw
      ? new Date(periodEndRaw).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
      : "";

  return (
    <div style={wrap()}>
      <div style={inner()}>
        <Link href="/dashboard" style={brand()}>
          InvoiceKu
        </Link>

        <div style={right()}>
          <div style={{ textAlign: "right", lineHeight: 1.25 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>
              {orgName || "—"}
            </div>
            <div style={{ color: "#64748b", fontSize: 12 }}>
              {orgCode ? (
                <>
                  <span style={{ fontWeight: 600 }}>Code: {orgCode}</span>
                  {daysLeft !== null ? (
                    <>
                      <span style={{ margin: "0 4px", color: "#94a3b8" }}>•</span>
                      <span style={expired ? { color: "#b91c1c", fontWeight: 600 } : {}}>
                        Sisa {daysLeft} hari
                      </span>
                    </>
                  ) : null}
                  <span style={{ margin: "0 4px", color: "#94a3b8" }}>•</span>
                </>
              ) : null}
              <span>Role: {roleDisplay}</span>
              {subLabel ? (
                <>
                  <span style={{ margin: "0 4px", color: "#94a3b8" }}>•</span>
                  <span style={expired ? { color: "#b91c1c", fontWeight: 600 } : {}}>
                    {subLabel}
                    {expiresLabel ? ` s/d ${expiresLabel}` : ""}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <form action="/api/auth/logout?redirect=/login" method="post">
            <button type="submit" style={btnPrimary()}>
              Logout
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function wrap(): React.CSSProperties {
  return {
    position: "sticky",
    top: 0,
    zIndex: 50,
    background: "white",
    borderBottom: "1px solid #eee",
  };
}

function inner(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: 1600,
    margin: "0 auto",
    padding: "12px 24px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "nowrap",
    boxSizing: "border-box",
  };
}

function brand(): React.CSSProperties {
  return {
    textDecoration: "none",
    color: "#111",
    fontWeight: 1000,
    fontSize: 16,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid transparent",
    flexShrink: 0,
    whiteSpace: "nowrap",
  };
}

function right(): React.CSSProperties {
  return {
    marginLeft: "auto",
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexShrink: 0,
    whiteSpace: "nowrap",
  };
}

function btnPrimary(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #111",
    background: "#111",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
}