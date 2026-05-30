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
    <div className="app-list-page" style={listPageShell}>
      <div className="app-list-page__header" style={listPageHeaderRow}>
        <div style={{ minWidth: 0 }}>
          <h1 style={listPageTitle}>{title}</h1>
          {subtitle ? <div style={listPageSubtitle}>{subtitle}</div> : null}
        </div>
        <div
          className="app-list-page__header-actions app-subpage-header-actions"
          style={listPageHeaderActions}
        >
          {actions}
          <AppHeaderNav />
        </div>
      </div>

      {plain ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 20 }}>{children}</div>
      ) : (
        <div className="app-list-page__card" style={listPageContentCard}>
          {cardTitle ? <div className="app-list-page__card-title" style={listPageCardHeading}>{cardTitle}</div> : null}
          {children}
        </div>
      )}
    </div>
  );
}
