// app/components/sidebar.tsx — App nav (reference: teal pill active, icons, collapse)
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import AppLogo from "./app-logo";
import AppNavLink from "./app-nav-link";

const TEAL = "#1E7F75";
const INACTIVE = "#949494";
const NAV_TOP = 56;

type NavItem = {
  href: string;
  label: string;
  icon: NavIconId;
  /** Org membership role admin/owner/super_admin */
  adminOnly?: boolean;
  /** App-level billing admin (app_user_roles or BILLING_ADMIN_EMAILS) */
  billingAdminOnly?: boolean;
};

type NavIconId =
  | "dashboard"
  | "quotation"
  | "invoice"
  | "delivery"
  | "po"
  | "customer"
  | "product"
  | "vendor"
  | "warehouse"
  | "activity"
  | "settings"
  | "feedback"
  | "billing"
  | "expense"
  | "receivable";

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/quotations", label: "Quotation", icon: "quotation" },
  { href: "/invoice", label: "Invoice", icon: "invoice" },
  { href: "/delivery-notes", label: "Surat Jalan", icon: "delivery" },
  { href: "/purchase-orders", label: "Purchase Order", icon: "po" },
  { href: "/expenses", label: "Pengeluaran", icon: "expense" },
  { href: "/receivables/dashboard", label: "Piutang", icon: "receivable" },
  { href: "/customers", label: "Customer", icon: "customer" },
  { href: "/products", label: "Barang", icon: "product" },
  { href: "/vendors", label: "Vendor", icon: "vendor" },
  { href: "/warehouses", label: "Gudang", icon: "warehouse" },
  { href: "/settings/activity", label: "Activity", icon: "activity", adminOnly: true },
  { href: "/settings", label: "Pengaturan", icon: "settings" },
  { href: "/admin/billing", label: "Billing Admin", icon: "billing", billingAdminOnly: true },
  { href: "/admin/feedback", label: "Kritik & Masukan", icon: "feedback", adminOnly: true },
];

function isAdminRole(role: string) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "owner" || r === "super_admin";
}

type Props = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
};

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: Props) {
  const supabase = supabaseBrowser();
  const pathname = usePathname();

  const [role, setRole] = useState<string>("");
  const [canBillingAdmin, setCanBillingAdmin] = useState(false);
  const [loadingNav, setLoadingNav] = useState(true);
  const [hoverHref, setHoverHref] = useState<string | null>(null);

  async function loadNavAccess() {
    setLoadingNav(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        setRole("");
        setCanBillingAdmin(false);
        return;
      }

      const [membershipRes, billingAccessRes] = await Promise.all([
        supabase
          .from("memberships")
          .select("role")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle(),
        fetch("/api/admin/billing/access", { credentials: "include" }).then((r) => r.json().catch(() => ({ allowed: false }))),
      ]);

      setRole(String((membershipRes.data as { role?: string } | null)?.role || ""));
      setCanBillingAdmin(Boolean((billingAccessRes as { allowed?: boolean })?.allowed));
    } finally {
      setLoadingNav(false);
    }
  }

  useEffect(() => {
    loadNavAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSeeAdmin = useMemo(() => isAdminRole(role), [role]);

  const items = useMemo(() => {
    return navItems.filter((it) => {
      if (it.billingAdminOnly) return canBillingAdmin;
      if (it.adminOnly) return canSeeAdmin;
      return true;
    });
  }, [canSeeAdmin, canBillingAdmin]);

  const closeIfMobile = () => {
    onCloseMobile?.();
  };

  const sidebarClass = ["app-sidebar", mobileOpen ? "app-sidebar--open" : ""].filter(Boolean).join(" ");

  return (
    <aside className={sidebarClass} style={wrap(collapsed)}>
      <div
        style={{
          display: "flex",
          flexDirection: collapsed ? "column" : "row",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: collapsed ? 12 : 8,
          marginBottom: 12,
          minHeight: collapsed ? undefined : 44,
        }}
      >
        {!collapsed ? (
          <AppNavLink
            href="/dashboard"
            onClick={closeIfMobile}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              color: TEAL,
              fontWeight: 800,
              fontSize: 17,
              letterSpacing: "-0.02em",
              paddingLeft: 4,
              minWidth: 0,
            }}
          >
            <AppLogo size={36} />
            Invoiceku
          </AppNavLink>
        ) : (
          <AppNavLink
            href="/dashboard"
            onClick={closeIfMobile}
            style={{ display: "grid", placeItems: "center", textDecoration: "none" }}
            title="Invoiceku"
          >
            <AppLogo size={40} />
          </AppNavLink>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          title={collapsed ? "Perluas menu" : "Ciutkan menu"}
          aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "none",
            background: TEAL,
            color: "#fff",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            boxShadow: "0 2px 6px rgba(30,127,117,0.35)",
          }}
        >
          <ChevronIcon collapsed={collapsed} />
        </button>
      </div>

      {loadingNav ? (
        <div style={{ fontSize: 11, color: "#bbb", marginBottom: 8, paddingLeft: collapsed ? 0 : 4, textAlign: collapsed ? "center" : "left" }}>
          …
        </div>
      ) : null}

      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          flex: 1,
          overflowY: "auto",
          paddingRight: 2,
        }}
      >
        {items.map((it) => {
          const isReceivablesNav = it.icon === "receivable";
          const isActive = isReceivablesNav
            ? pathname.startsWith("/receivables")
            : pathname === it.href || pathname.startsWith(it.href + "/");
          const hovered = !isActive && hoverHref === it.href;
          return (
            <AppNavLink
              key={it.href}
              href={it.href}
              title={collapsed ? it.label : undefined}
              style={navItemStyle(collapsed, isActive, hovered)}
              aria-current={isActive ? "page" : undefined}
              onClick={closeIfMobile}
              onMouseEnter={() => setHoverHref(it.href)}
              onMouseLeave={() => setHoverHref(null)}
            >
              <span style={{ display: "grid", placeItems: "center", width: 22, height: 22, flexShrink: 0 }}>
                <NavIcon id={it.icon} variant={isActive ? "active" : hovered ? "hover" : "idle"} />
              </span>
              {!collapsed ? <span>{it.label}</span> : null}
            </AppNavLink>
          );
        })}
      </nav>
    </aside>
  );
}

function navItemStyle(collapsed: boolean, active: boolean, hovered: boolean): CSSProperties {
  if (active) return itemActive(collapsed);
  const base = itemInactive(collapsed);
  if (hovered) {
    return {
      ...base,
      background: "rgba(30, 127, 117, 0.09)",
      color: TEAL,
    };
  }
  return base;
}

function wrap(collapsed: boolean): CSSProperties {
  return {
    position: "sticky" as const,
    top: NAV_TOP,
    alignSelf: "flex-start",
    height: `calc(100vh - ${NAV_TOP}px)`,
    overflowY: "auto",
    overflowX: "hidden",
    padding: collapsed ? "14px 8px 20px" : "16px 14px 24px",
    background: "#fff",
    borderRight: "1px solid #E8EAED",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    boxShadow: "2px 0 12px rgba(15, 23, 42, 0.04)",
  };
}

function itemBase(collapsed: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: collapsed ? "center" : "flex-start",
    gap: collapsed ? 0 : 12,
    padding: collapsed ? "10px 8px" : "10px 16px",
    borderRadius: 10,
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 14,
    transition: "background 0.15s ease, color 0.15s ease",
    boxSizing: "border-box",
  };
}

function itemActive(collapsed: boolean): CSSProperties {
  return {
    ...itemBase(collapsed),
    background: TEAL,
    color: "#fff",
  };
}

function itemInactive(collapsed: boolean): CSSProperties {
  return {
    ...itemBase(collapsed),
    background: "transparent",
    color: INACTIVE,
  };
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden style={{ transform: collapsed ? "rotate(180deg)" : "none" }}>
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NavIcon({ id, variant }: { id: NavIconId; variant: "active" | "hover" | "idle" }) {
  const c = variant === "active" ? "#fff" : variant === "hover" ? TEAL : INACTIVE;
  switch (id) {
    case "dashboard":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3" y="3" width="7" height="7" rx="1.5" stroke={c} strokeWidth="1.75" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" stroke={c} strokeWidth="1.75" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" stroke={c} strokeWidth="1.75" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" stroke={c} strokeWidth="1.75" />
        </svg>
      );
    case "quotation":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke={c} strokeWidth="1.75" strokeLinecap="round" />
          <path d="M9 12h6M9 16h4" stroke={c} strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "invoice":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M7 7h10v14H7V7z" stroke={c} strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M9 11h6M9 15h4" stroke={c} strokeWidth="1.75" strokeLinecap="round" />
          <path d="M10 3h4v4h-4V3z" stroke={c} strokeWidth="1.75" strokeLinejoin="round" />
        </svg>
      );
    case "delivery":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 7h12v10H3V7z" stroke={c} strokeWidth="1.75" />
          <path d="M15 10h3l3 3v4h-6v-7z" stroke={c} strokeWidth="1.75" strokeLinejoin="round" />
          <circle cx="8" cy="19" r="1.5" fill={c} />
          <circle cx="18" cy="19" r="1.5" fill={c} />
        </svg>
      );
    case "po":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="2" y="6" width="20" height="12" rx="2" stroke={c} strokeWidth="1.75" />
          <path d="M6 10h4M6 14h8" stroke={c} strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "customer":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="9" cy="8" r="3" stroke={c} strokeWidth="1.75" />
          <circle cx="17" cy="9" r="2.5" stroke={c} strokeWidth="1.75" />
          <path d="M3 20v-1a4 4 0 014-4h4a4 4 0 014 4v1M15 20v-1a3 3 0 013-3" stroke={c} strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "product":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 3l8 4v10l-8 4-8-4V7l8-4z" stroke={c} strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M12 12l8-4M12 12v10M12 12L4 8" stroke={c} strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "vendor":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="4" y="5" width="16" height="14" rx="2" stroke={c} strokeWidth="1.75" />
          <circle cx="12" cy="11" r="3" stroke={c} strokeWidth="1.75" />
          <path d="M8 19h8" stroke={c} strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "warehouse":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 10l9-6 9 6v10a1 1 0 01-1 1H4a1 1 0 01-1-1V10z" stroke={c} strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M9 22V12h6v10" stroke={c} strokeWidth="1.75" strokeLinejoin="round" />
        </svg>
      );
    case "activity":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke={c} strokeWidth="1.75" strokeLinecap="round" />
          <path d="M3 6l2 2-2 2" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "settings":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="3" stroke={c} strokeWidth="1.75" />
          <path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
            stroke={c}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "feedback":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M21 15a2 2 0 01-2 2H8l-4 3V5a2 2 0 012-2h13a2 2 0 012 2v10z" stroke={c} strokeWidth="1.75" strokeLinejoin="round" />
        </svg>
      );
    case "billing":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="2" y="5" width="20" height="14" rx="2" stroke={c} strokeWidth="1.75" />
          <path d="M2 10h20" stroke={c} strokeWidth="1.75" />
          <path d="M6 15h4" stroke={c} strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "expense":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 2v20M17 7H9.5a3.5 3.5 0 100 7H14a3.5 3.5 0 110 7H6" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "receivable":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3" y="6" width="18" height="12" rx="2.5" stroke={c} strokeWidth="1.75" />
          <path d="M3 10h18" stroke={c} strokeWidth="1.75" />
          <path d="M7 14h5" stroke={c} strokeWidth="1.75" strokeLinecap="round" />
          <path d="M16 14h1" stroke={c} strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}
