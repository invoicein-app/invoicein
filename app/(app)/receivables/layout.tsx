"use client";

import AppNavLink from "@/app/components/app-nav-link";
import { usePathname } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";
import { APP_BORDER, APP_TEAL } from "../components/app-ui-tokens";

const tabs = [
  { href: "/receivables/dashboard", label: "Dashboard" },
  { href: "/receivables", label: "Piutang Customer", exact: true },
  { href: "/receivables/manual", label: "Piutang Lainnya" },
  { href: "/receivables/payables", label: "Hutang" },
];

export default function ReceivablesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [hoverHref, setHoverHref] = useState<string | null>(null);

  return (
    <div style={{ width: "100%", boxSizing: "border-box" }}>
      <nav
        className="app-module-nav app-module-nav--receivables"
        style={{
          margin: "0 20px 16px",
          padding: "14px 16px",
          border: `1px solid ${APP_BORDER}`,
          borderRadius: 12,
          background: "#fff",
          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 10 }}>
          Modul Hutang / Piutang
        </div>
        <div className="app-module-nav__tabs" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
            const hovered = !active && hoverHref === t.href;
            return (
              <AppNavLink
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                style={tabStyle(active, hovered)}
                onMouseEnter={() => setHoverHref(t.href)}
                onMouseLeave={() => setHoverHref(null)}
              >
                {t.label}
              </AppNavLink>
            );
          })}
        </div>
      </nav>
      {children}
    </div>
  );
}

function tabStyle(active: boolean, hovered: boolean): CSSProperties {
  if (active) {
    return {
      padding: "10px 16px",
      borderRadius: 9,
      border: `2px solid ${APP_TEAL}`,
      background: APP_TEAL,
      color: "#fff",
      textDecoration: "none",
      fontWeight: 800,
      fontSize: 14,
    };
  }
  if (hovered) {
    return {
      padding: "10px 16px",
      borderRadius: 9,
      border: `2px solid ${APP_TEAL}`,
      background: "rgba(45,125,113,0.1)",
      color: APP_TEAL,
      textDecoration: "none",
      fontWeight: 800,
      fontSize: 14,
    };
  }
  return {
    padding: "10px 16px",
    borderRadius: 9,
    border: "2px solid #cbd5e1",
    background: "#fff",
    color: "#334155",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
  };
}
