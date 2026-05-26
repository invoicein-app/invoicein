import type { CSSProperties } from "react";
import { APP_BORDER } from "../components/app-ui-tokens";

/** Jarak bawah blok tab → area halaman (selaras jarak header ListPageLayout). */
export const EXPENSE_NAV_BOTTOM = 48;

/** Wrapper modul (di layout). */
export const expenseModuleWrap: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "0 0 40px",
};

/**
 * Area isi halaman — padding atas sama seperti shell ListPageLayout
 * supaya Biaya Bulanan / Ringkasan se-rata halaman Pengeluaran.
 */
export const expensePageContentArea: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  paddingTop: 16,
  paddingBottom: 8,
};

export const expensePageShell: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
};

export const expenseHeaderRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 20,
  flexWrap: "wrap",
  marginBottom: 28,
  paddingBottom: 4,
};

export const expenseHeaderActions: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
  flexShrink: 0,
  paddingTop: 2,
};

export const expensePageTitle: CSSProperties = {
  margin: "20px 0 0 0",
  fontSize: 22,
  fontWeight: 800,
  color: "#333",
  lineHeight: 1.35,
};

export const expensePageSubtitle: CSSProperties = {
  color: "#64748b",
  marginTop: 12,
  fontSize: 14,
  lineHeight: 1.6,
  maxWidth: 720,
};

/** Kartu konten — marginTop mengikuti ListPageLayout card (20px dari header). */
export const expenseContentCard: CSSProperties = {
  marginTop: 4,
  background: "#fff",
  border: `1px solid ${APP_BORDER}`,
  borderRadius: 10,
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  padding: "24px 24px 16px",
  boxSizing: "border-box",
};

export const expenseCardHeading: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#333",
  marginBottom: 20,
  lineHeight: 1.3,
};

export const expensePlainBody: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 24,
};

export const expenseKpiGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 16,
};

export const expenseTableWrap: CSSProperties = {
  width: "100%",
  overflowX: "auto",
  marginTop: 4,
};

export function expenseAlertBox(): CSSProperties {
  return {
    marginBottom: 20,
    border: "1px solid #ffd6d6",
    background: "#fff5f5",
    color: "#8a1f1f",
    borderRadius: 12,
    padding: 12,
    fontWeight: 700,
    fontSize: 14,
    lineHeight: 1.45,
  };
}

export const expenseMonthInput: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  border: `1px solid ${APP_BORDER}`,
  fontSize: 14,
  fontWeight: 600,
  background: "#fff",
  color: "#334155",
};

export const expenseMainCard = expenseContentCard;

/** Untuk halaman list yang sudah pakai ListPageLayout — hindari double padding. */
export const expenseListPageWrap: CSSProperties = {
  marginTop: -8,
};
