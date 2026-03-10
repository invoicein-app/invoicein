"use client";

import Link from "next/link";

/**
 * Layout daftar dengan model design sama seperti halaman Invoice:
 * - Header (judul + subtitle + tombol)
 * - Card filter
 * - Bar pagination atas (Total • Page • Per page + First/Prev/Next/Last)
 * - Card tabel
 * - Bar pagination bawah
 */
type PaginationUrls = {
  firstUrl: string;
  prevUrl: string;
  nextUrl: string;
  lastUrl: string;
};

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
  /** Server-side: link URLs. Client-side: omit and use clientPagination instead. */
  paginationUrls?: PaginationUrls;
  /** Client-side pagination: callback when user clicks First/Prev/Next/Last */
  clientPagination?: ClientPagination;
  tableContent: React.ReactNode;
  emptyMessage?: string;
};

const containerStyle: React.CSSProperties = {
  width: "100%",
  padding: 24,
  boxSizing: "border-box",
};
const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};
const titleStyle: React.CSSProperties = { fontSize: 24, fontWeight: 800, margin: 0 };
const subtitleStyle: React.CSSProperties = { color: "#666", marginTop: 4 };
const btnWrapStyle: React.CSSProperties = { display: "flex", gap: 10, alignItems: "center" };
const btnSecondaryStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
  textDecoration: "none",
  color: "#111",
  fontWeight: 600,
};
const btnPrimaryStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  background: "#111",
  color: "white",
  textDecoration: "none",
  fontWeight: 600,
};
const filterCardStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #eee",
  background: "white",
};
const pagerBarStyle: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 10,
  color: "#666",
  fontSize: 13,
};
const tableCardStyle: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid #eee",
  borderRadius: 14,
  overflowX: "auto",
  background: "white",
};
const pagerBtnStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #eee",
  textDecoration: "none",
  color: "#111",
  background: "white",
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
  paginationUrls,
  clientPagination,
  tableContent,
  emptyMessage = "Tidak ada data yang cocok dengan filter.",
}: Props) {
  const PagerLink = ({ url, onClick, label }: { url?: string; onClick?: () => void; label: string }) => {
    if (onClick) {
      return (
        <button type="button" onClick={onClick} style={pagerBtnStyle}>
          {label}
        </button>
      );
    }
    return <Link href={url!} style={pagerBtnStyle}>{label}</Link>;
  };

  const nav = paginationUrls
    ? {
        first: <PagerLink url={paginationUrls.firstUrl} label="« First" />,
        prev: <PagerLink url={paginationUrls.prevUrl} label="‹ Prev" />,
        next: <PagerLink url={paginationUrls.nextUrl} label="Next ›" />,
        last: <PagerLink url={paginationUrls.lastUrl} label="Last »" />,
      }
    : clientPagination
    ? {
        first: <PagerLink onClick={clientPagination.onFirst} label="« First" />,
        prev: <PagerLink onClick={clientPagination.onPrev} label="‹ Prev" />,
        next: <PagerLink onClick={clientPagination.onNext} label="Next ›" />,
        last: <PagerLink onClick={clientPagination.onLast} label="Last »" />,
      }
    : null;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>{title}</h1>
          {subtitle ? <div style={subtitleStyle}>{subtitle}</div> : null}
        </div>
        <div style={btnWrapStyle}>
          {secondaryLink ? (
            <Link href={secondaryLink.href} style={btnSecondaryStyle}>
              {secondaryLink.label}
            </Link>
          ) : null}
          {primaryLink ? (
            <Link href={primaryLink.href} style={btnPrimaryStyle}>
              {primaryLink.label}
            </Link>
          ) : null}
        </div>
      </div>

      <div style={filterCardStyle}>{filters}</div>

      {nav ? (
        <div style={pagerBarStyle}>
          <div>
            Total: <b>{totalRows}</b> • Page: <b>{Math.min(page, totalPages)}</b> / <b>{totalPages}</b> • Per page: <b>{pageSize}</b>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {nav.first}
            {nav.prev}
            {nav.next}
            {nav.last}
          </div>
        </div>
      ) : null}

      <div style={tableCardStyle}>{tableContent}</div>

      {nav ? (
        <div style={pagerBarStyle}>
          <div>
            Menampilkan <b>{Math.min(fromIdx + 1, totalRows)}</b>–<b>{Math.min(toIdx + 1, totalRows)}</b> dari <b>{totalRows}</b>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {nav.first}
            {nav.prev}
            {nav.next}
            {nav.last}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { pagerBtnStyle, tableCardStyle, filterCardStyle, btnPrimaryStyle, btnSecondaryStyle };
export const listTableStyles = {
  table: { width: "100%" as const, borderCollapse: "collapse" as const, fontSize: 14 },
  thead: { background: "#fafafa", color: "#555" },
  th: { padding: 12, textAlign: "left" as const },
  td: { padding: 12, borderTop: "1px solid #eee" as const },
  tdCenter: { padding: 12, textAlign: "center" as const, borderTop: "1px solid #eee" as const },
  tdRight: { padding: 12, textAlign: "right" as const, borderTop: "1px solid #eee" as const },
  empty: { padding: 20, textAlign: "center" as const, color: "#666" },
};
