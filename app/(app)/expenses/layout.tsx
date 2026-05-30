"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";
import { APP_BORDER, APP_TEAL } from "../components/app-ui-tokens";
import { EXPENSE_NAV_BOTTOM, expenseModuleWrap } from "./expense-page-styles";

const TEAL = APP_TEAL;

const tabs = [
  { href: "/expenses", label: "Pengeluaran", exact: true },
  { href: "/expenses/recurring", label: "Biaya Bulanan" },
  { href: "/expenses/summary", label: "Ringkasan Bulanan" },
];

export default function ExpensesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [hoverHref, setHoverHref] = useState<string | null>(null);

  return (
    <div className="app-expense-module" style={expenseModuleWrap}>
      <nav
        className="app-module-nav"
        aria-label="Navigasi modul pengeluaran"
        style={{
          marginBottom: EXPENSE_NAV_BOTTOM,
          padding: "16px 18px 18px",
          background: "#fff",
          border: `1px solid ${APP_BORDER}`,
          borderRadius: 12,
          boxShadow: "0 2px 10px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#64748b",
            marginBottom: 12,
          }}
        >
          Modul Pengeluaran
        </div>
        <div
          className="app-module-nav__tabs"
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "stretch",
          }}
        >
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
            const hovered = !active && hoverHref === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                style={tabStyle(active, hovered)}
                onMouseEnter={() => setHoverHref(t.href)}
                onMouseLeave={() => setHoverHref(null)}
              >
                {t.label}
              </Link>
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
      padding: "12px 22px",
      borderRadius: 10,
      textDecoration: "none",
      fontWeight: 800,
      fontSize: 14,
      lineHeight: 1.25,
      background: TEAL,
      color: "#fff",
      border: `2px solid ${TEAL}`,
      boxShadow: "0 3px 10px rgba(45, 125, 113, 0.35)",
      cursor: "pointer",
      transition: "background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease",
      whiteSpace: "nowrap",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
    };
  }

  if (hovered) {
    return {
      padding: "12px 22px",
      borderRadius: 10,
      textDecoration: "none",
      fontWeight: 800,
      fontSize: 14,
      lineHeight: 1.25,
      background: "rgba(45, 125, 113, 0.1)",
      color: TEAL,
      border: `2px solid ${TEAL}`,
      boxShadow: "0 1px 4px rgba(45, 125, 113, 0.12)",
      cursor: "pointer",
      transition: "background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease",
      whiteSpace: "nowrap",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
    };
  }

  return {
    padding: "12px 22px",
    borderRadius: 10,
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
    lineHeight: 1.25,
    background: "#fff",
    color: "#334155",
    border: "2px solid #cbd5e1",
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
    cursor: "pointer",
    transition: "background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  };
}
