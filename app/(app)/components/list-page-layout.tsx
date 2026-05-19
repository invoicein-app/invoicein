"use client";

import Link from "next/link";
import AppHeaderNav from "./app-header-nav";
import { APP_BORDER, APP_BG, APP_TEAL } from "./app-ui-tokens";

type ClientPagination = {
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
};

type Props = {
  title: string;
  subtitle?: string;
  primaryLink?: { href: string; label: string };
  secondaryLink?: { href: string; label: string };
  filters: React.ReactNode;
  totalRows: number;
  page: number;
  totalPages: number;
  pageSize: number;
  fromIdx: number;
  toIdx: number;
  clientPagination: ClientPagination;
  tableContent: React.ReactNode;
  /** Judul di dalam kartu putih (default: Master Data · {title}) */
  listCardTitle?: string;
  /** Dropdown ukuran halaman di footer (wajib bareng onPageSizeChange) */
  onPageSizeChange?: (n: number) => void;
  perPageOptions?: number[];
};

const shell: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: APP_BG,
  minHeight: "100%",
  padding: "16px 20px 40px",
};

const btnOutline: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 8,
  border: `2px solid ${APP_TEAL}`,
  background: "#fff",
  color: APP_TEAL,
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 14,
  whiteSpace: "nowrap",
};

const btnSolid: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "none",
  background: APP_TEAL,
  color: "#fff",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 14,
  whiteSpace: "nowrap",
};

const card: React.CSSProperties = {
  marginTop: 20,
  background: "#fff",
  border: `1px solid ${APP_BORDER}`,
  borderRadius: 10,
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  padding: "20px 20px 8px",
  boxSizing: "border-box",
};

export default function ListPageLayout({
  title,
  subtitle,
  primaryLink,
  secondaryLink,
  filters,
  totalRows,
  page,
  totalPages,
  pageSize,
  fromIdx,
  toIdx,
  clientPagination,
  tableContent,
  listCardTitle,
  onPageSizeChange,
  perPageOptions = [10, 20, 30, 50],
}: Props) {
  const cardHeading = listCardTitle ?? `Master Data · ${title}`;

  return (
    <div style={shell}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 4,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#333" }}>{title}</h1>
          {subtitle ? (
            <div style={{ color: "#64748b", marginTop: 6, fontSize: 14, lineHeight: 1.45, maxWidth: 720 }}>{subtitle}</div>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {secondaryLink ? (
            <Link href={secondaryLink.href} style={btnOutline}>
              {secondaryLink.label}
            </Link>
          ) : null}
          {primaryLink ? (
            <Link href={primaryLink.href} style={btnSolid}>
              {primaryLink.label}
            </Link>
          ) : null}
          <AppHeaderNav />
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#333", marginBottom: 16 }}>{cardHeading}</div>

        <div style={{ marginBottom: 16 }}>{filters}</div>

        <div style={{ width: "100%", overflowX: "auto" }}>{tableContent}</div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            marginTop: 16,
            paddingTop: 16,
            paddingBottom: 8,
            borderTop: `1px solid ${APP_BORDER}`,
            fontSize: 13,
            color: "#64748b",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>Menampilkan</span>
            {onPageSizeChange ? (
              <select
                value={String(pageSize)}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: `1px solid ${APP_BORDER}`,
                  fontWeight: 700,
                  color: "#333",
                  background: "#fff",
                }}
              >
                {perPageOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            ) : (
              <b style={{ color: "#333" }}>{pageSize}</b>
            )}
            <span>
              Dari <b style={{ color: "#333" }}>{totalRows}</b> Data
            </span>
            <span style={{ color: "#94a3b8" }}>
              {totalRows === 0 ? "" : (
                <>
                  ({Math.min(fromIdx + 1, totalRows)}–{Math.min(toIdx + 1, totalRows)})
                </>
              )}
            </span>
          </div>

          <nav style={{ display: "flex", alignItems: "center", gap: 8 }} aria-label="Pagination">
            <PagerBtn onClick={clientPagination.onPrev} disabled={page <= 1} label="< Prev" />
            <span style={pagerActive()}>{Math.min(page, totalPages)}</span>
            <PagerBtn onClick={clientPagination.onNext} disabled={page >= totalPages} label="Next >" />
            <span style={{ width: 8 }} />
            <PagerBtn onClick={clientPagination.onFirst} disabled={page <= 1} label="«" title="Halaman pertama" />
            <PagerBtn onClick={clientPagination.onLast} disabled={page >= totalPages} label="»" title="Halaman terakhir" />
          </nav>
        </div>
      </div>

    </div>
  );
}

function PagerBtn({
  onClick,
  disabled,
  label,
  title,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={disabled ? { ...pagerBtn(), opacity: 0.45, pointerEvents: "none", cursor: "not-allowed" } : pagerBtn()}
    >
      {label}
    </button>
  );
}

function pagerBtn(): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 8,
    border: `1px solid ${APP_BORDER}`,
    background: "#fff",
    color: "#334155",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };
}

function pagerActive(): React.CSSProperties {
  return {
    minWidth: 36,
    height: 36,
    display: "inline-grid",
    placeItems: "center",
    padding: "0 10px",
    borderRadius: "50%",
    background: APP_TEAL,
    color: "#fff",
    fontWeight: 800,
    fontSize: 14,
  };
}

export const listTableStyles = {
  table: { width: "100%" as const, borderCollapse: "collapse" as const, fontSize: 14, minWidth: 640 },
  thead: { background: "#f9fafb" } as React.CSSProperties,
  th: {
    textAlign: "left" as const,
    padding: "12px 10px",
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    borderBottom: `1px solid ${APP_BORDER}`,
    whiteSpace: "nowrap" as const,
  },
  td: {
    padding: "14px 10px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "top" as const,
    color: "#334155",
  },
  tdCenter: {
    padding: "14px 10px",
    textAlign: "center" as const,
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "middle" as const,
  },
  tdRight: {
    padding: "14px 10px",
    textAlign: "right" as const,
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "middle" as const,
  },
  empty: { padding: 28, textAlign: "center" as const, color: "#94a3b8", fontWeight: 600 },
};

export { APP_TEAL, APP_BG, APP_BORDER } from "./app-ui-tokens";
