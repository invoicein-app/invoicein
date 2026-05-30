import type { CSSProperties } from "react";
import { APP_BG, APP_BORDER } from "./app-ui-tokens";

/** Dipakai ListPageLayout + sub-halaman modul (expenses recurring/summary). */
export const listPageShell: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: APP_BG,
  minHeight: "100%",
  padding: "16px 20px 40px",
};

export const listPageHeaderRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 4,
};

export const listPageTitle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 800,
  color: "#333",
};

export const listPageSubtitle: CSSProperties = {
  color: "#64748b",
  marginTop: 6,
  fontSize: 14,
  lineHeight: 1.45,
  maxWidth: 720,
};

export const listPageContentCard: CSSProperties = {
  marginTop: 20,
  background: "#fff",
  border: `1px solid ${APP_BORDER}`,
  borderRadius: 10,
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  padding: "20px 20px 8px",
  boxSizing: "border-box",
  minWidth: 0,
  maxWidth: "100%",
};

export const listPageCardHeading: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#333",
  marginBottom: 16,
};

export const listPageHeaderActions: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};
