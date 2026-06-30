"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";
import AppNavLink from "@/app/components/app-nav-link";
import { useAppRouter } from "@/app/components/use-app-router";
import { useNavProgressOptional } from "@/app/components/nav-progress-context";

const TEAL = "#2D7D71";

type Props = {
  page: number;
  totalPages: number;
  totalRows: number;
  pageSize: number;
  /** Current URLSearchParams without `p` (page will be merged) */
  baseQuery: string;
};

function buildHref(baseQuery: string, patch: Record<string, string>) {
  const next = new URLSearchParams(baseQuery);
  for (const [k, v] of Object.entries(patch)) {
    if (v === "") next.delete(k);
    else next.set(k, v);
  }
  const qs = next.toString();
  return qs ? `/invoice?${qs}` : "/invoice";
}

/** Visible page numbers with ellipsis for large page counts */
function visiblePages(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const out: Array<number | "ellipsis"> = [];
  const windowSize = 2;
  const left = Math.max(2, current - windowSize);
  const right = Math.min(total - 1, current + windowSize);

  out.push(1);
  if (left > 2) out.push("ellipsis");
  for (let p = left; p <= right; p++) out.push(p);
  if (right < total - 1) out.push("ellipsis");
  if (total > 1) out.push(total);
  return out;
}

export default function InvoicePaginationClient({
  page,
  totalPages,
  totalRows,
  pageSize,
  baseQuery,
}: Props) {
  const { push } = useAppRouter();
  const nav = useNavProgressOptional();
  const isNavigating = Boolean(nav?.isNavigating);

  const pages = useMemo(() => visiblePages(page, totalPages), [page, totalPages]);

  const start = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalRows);

  function onPageSizeChange(ps: string) {
    push(buildHref(baseQuery, { ps, p: "1" }));
  }

  function pagerNavStyle(active = false, disabled = false): CSSProperties {
    if (disabled || isNavigating) {
      return { ...(active ? pagerActive() : pagerLink()), opacity: 0.45, pointerEvents: "none", cursor: "not-allowed" };
    }
    return active ? pagerActive() : pagerLink();
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16,
        marginTop: 20,
        paddingTop: 16,
        borderTop: "1px solid #eee",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 13, color: "#666" }}>
        <span>
          Menampilkan{" "}
          <select
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(e.target.value)}
            disabled={isNavigating}
            style={{
              margin: "0 6px",
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              fontWeight: 700,
              color: "#333",
              background: "#fff",
            }}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="30">30</option>
            <option value="50">50</option>
          </select>{" "}
          Dari <b style={{ color: "#333" }}>{totalRows}</b> Data
        </span>
        <span style={{ color: "#94a3b8" }}>
          {start}–{end} dari {totalRows}
        </span>
      </div>

      <nav style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }} aria-label="Pagination">
        {page <= 1 ? (
          <span style={pagerDisabled()}>&lt; Prev</span>
        ) : (
          <AppNavLink href={buildHref(baseQuery, { p: String(page - 1) })} style={pagerNavStyle()}>
            &lt; Prev
          </AppNavLink>
        )}

        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <span key={`e-${i}`} style={{ padding: "0 4px", color: "#94a3b8" }}>
              …
            </span>
          ) : (
            <AppNavLink
              key={p}
              href={buildHref(baseQuery, { p: String(p) })}
              style={pagerNavStyle(p === page)}
            >
              {p}
            </AppNavLink>
          )
        )}

        {page >= totalPages ? (
          <span style={pagerDisabled()}>Next &gt;</span>
        ) : (
          <AppNavLink href={buildHref(baseQuery, { p: String(page + 1) })} style={pagerNavStyle()}>
            Next &gt;
          </AppNavLink>
        )}
        {isNavigating ? (
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginLeft: 4 }}>Memuat...</span>
        ) : null}
      </nav>
    </div>
  );
}

function pagerBase(): CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#e2e8f0",
    textDecoration: "none",
    color: "#334155",
    background: "#fff",
    fontSize: 13,
    fontWeight: 600,
    minWidth: 32,
    textAlign: "center",
    boxSizing: "border-box",
  };
}

function pagerLink(): CSSProperties {
  return pagerBase();
}

function pagerActive(): CSSProperties {
  return {
    ...pagerBase(),
    background: TEAL,
    borderColor: TEAL,
    color: "#fff",
  };
}

function pagerDisabled(): CSSProperties {
  return {
    ...pagerBase(),
    opacity: 0.45,
    pointerEvents: "none",
    cursor: "not-allowed",
  };
}
