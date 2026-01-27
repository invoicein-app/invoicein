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
    .select("role, organizations:organizations(name)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const orgName = (membership as any)?.organizations?.name || "";
  const role = (membership as any)?.role || "";
  const isAdmin = isAdminRole(role);

  return (
    <div style={wrap()}>
      <div style={inner()}>
        <Link href="/dashboard" style={brand()}>
          InvoiceKu
        </Link>

        <div style={right()}>
          <div style={{ textAlign: "right", lineHeight: 1.1 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>
              {orgName || "—"}
            </div>
            <div style={{ color: "#666", fontSize: 12 }}>
              Role: {role || "-"}
              {isAdmin ? " • Admin" : ""}
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
    maxWidth: 1200,
    margin: "0 auto",
    padding: "12px 18px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "nowrap",
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