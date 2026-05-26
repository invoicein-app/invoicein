"use client";

import type { ReactNode } from "react";
import AppHeaderNav from "../components/app-header-nav";
import {
  listPageCardHeading,
  listPageContentCard,
  listPageHeaderActions,
  listPageHeaderRow,
  listPageShell,
  listPageSubtitle,
  listPageTitle,
} from "../components/list-page-shell-styles";

type Props = {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  cardTitle?: string;
  plain?: boolean;
  children: ReactNode;
};

/** Sama shell/header/kartu seperti ListPageLayout (halaman Pengeluaran). */
export default function ExpenseSubPageShell({
  title,
  subtitle,
  actions,
  cardTitle,
  plain,
  children,
}: Props) {
  return (
    <div style={listPageShell}>
      <div style={listPageHeaderRow}>
        <div style={{ minWidth: 0 }}>
          <h1 style={listPageTitle}>{title}</h1>
          {subtitle ? <div style={listPageSubtitle}>{subtitle}</div> : null}
        </div>
        <div style={listPageHeaderActions}>
          {actions}
          <AppHeaderNav />
        </div>
      </div>

      {plain ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 20 }}>{children}</div>
      ) : (
        <div style={listPageContentCard}>
          {cardTitle ? <div style={listPageCardHeading}>{cardTitle}</div> : null}
          {children}
        </div>
      )}
    </div>
  );
}
