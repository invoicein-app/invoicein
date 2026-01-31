// ✅ FULL REPLACE FILE
// app/components/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type NavItem = { href: string; label: string; adminOnly?: boolean };

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/quotations", label: "Quotations" }, // ✅ NEW
  { href: "/invoice", label: "Invoice" },
  { href: "/delivery-notes", label: "Surat Jalan" },
  { href: "/customers", label: "Customer" },
  { href: "/products", label: "Barang" },

  { href: "/settings/activity", label: "Activity", adminOnly: true },
  { href: "/settings", label: "Pengaturan" },
];

function isAdminRole(role: string) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "owner" || r === "super_admin";
}

export default function Sidebar() {
  const supabase = supabaseBrowser();
  const pathname = usePathname();

  const [role, setRole] = useState<string>("");
  const [loadingRole, setLoadingRole] = useState(true);

  async function loadRole() {
    setLoadingRole(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        setRole("");
        return;
      }

      const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      setRole(String((membership as any)?.role || ""));
    } finally {
      setLoadingRole(false);
    }
  }

  useEffect(() => {
    loadRole();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSeeAdmin = useMemo(() => isAdminRole(role), [role]);

  const items = useMemo(() => {
    return navItems.filter((it) => (!it.adminOnly ? true : canSeeAdmin));
  }, [canSeeAdmin]);

  return (
    <aside style={wrap()}>
      <div style={sectionTitle()}>
        Menu {loadingRole ? <span style={{ fontWeight: 600, color: "#999" }}>•</span> : null}
      </div>

      <nav style={{ display: "grid", gap: 8 }}>
        {items.map((it) => {
          const isActive = pathname === it.href;

          return (
            <Link
              key={it.href}
              href={it.href}
              style={isActive ? itemActive() : item()}
              aria-current={isActive ? "page" : undefined}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: 14, borderTop: "1px solid #eee", paddingTop: 12, display: "grid", gap: 8 }}>
        <Link href="/invoice/new" style={cta()}>
          + Buat Invoice
        </Link>

        {/* ✅ optional quick action */}
        <Link href="/quotations/new" style={ctaSecondary()}>
          + Buat Quotation
        </Link>
      </div>
    </aside>
  );
}

function wrap(): React.CSSProperties {
  return {
    position: "sticky",
    top: 60,
    alignSelf: "flex-start",
    height: "calc(100vh - 60px)",
    overflowY: "auto",
    padding: 12,
    border: "1px solid #eee",
    borderRadius: 14,
    background: "white",
  };
}

function sectionTitle(): React.CSSProperties {
  return { fontSize: 12, color: "#666", fontWeight: 800, marginBottom: 10 };
}

function item(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #eee",
    textDecoration: "none",
    color: "#111",
    fontWeight: 800,
    background: "white",
  };
}

function itemActive(): React.CSSProperties {
  return {
    ...item(),
    border: "1px solid #111",
    background: "#111",
    color: "white",
  };
}

function cta(): React.CSSProperties {
  return {
    display: "block",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111",
    background: "#111",
    color: "white",
    textDecoration: "none",
    fontWeight: 900,
    textAlign: "center",
  };
}

function ctaSecondary(): React.CSSProperties {
  return {
    display: "block",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111",
    background: "white",
    color: "#111",
    textDecoration: "none",
    fontWeight: 900,
    textAlign: "center",
  };
}