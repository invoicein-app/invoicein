"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { APP_BORDER, APP_TEAL } from "../components/app-ui-tokens";

type Props = {
  pageSize: number;
  totalRows: number;
  fromIdx: number;
  toIdx: number;
  page: number;
  totalPages: number;
  prevUrl: string;
  nextUrl: string;
  firstUrl: string;
  lastUrl: string;
};

const perPageOptions = [10, 20, 30, 50];

export default function DeliveryNotesListFooterClient({
  pageSize,
  totalRows,
  fromIdx,
  toIdx,
  page,
  totalPages,
  prevUrl,
  nextUrl,
  firstUrl,
  lastUrl,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function onPageSizeChange(n: number) {
    const next = new URLSearchParams(sp.toString());
    next.set("ps", String(n));
    next.set("p", "1");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div
      className="app-list-page__footer"
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
          aria-label="Jumlah baris per halaman"
        >
          {perPageOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span>
          Dari <b style={{ color: "#333" }}>{totalRows}</b> Data
        </span>
        {totalRows > 0 ? (
          <span style={{ color: "#94a3b8" }}>
            ({Math.min(fromIdx + 1, totalRows)}–{Math.min(toIdx + 1, totalRows)})
          </span>
        ) : null}
      </div>

      <nav style={{ display: "flex", alignItems: "center", gap: 8 }} aria-label="Pagination">
        {page <= 1 ? (
          <span style={pagerDisabled()}>&lt; Prev</span>
        ) : (
          <Link href={prevUrl} style={pagerBtn()}>
            &lt; Prev
          </Link>
        )}
        <span style={pagerActive()}>{page}</span>
        {page >= totalPages ? (
          <span style={pagerDisabled()}>Next &gt;</span>
        ) : (
          <Link href={nextUrl} style={pagerBtn()}>
            Next &gt;
          </Link>
        )}
        <span style={{ width: 8 }} />
        {page <= 1 ? (
          <span style={pagerDisabled()}>«</span>
        ) : (
          <Link href={firstUrl} style={pagerBtn()}>
            «
          </Link>
        )}
        {page >= totalPages ? (
          <span style={pagerDisabled()}>»</span>
        ) : (
          <Link href={lastUrl} style={pagerBtn()}>
            »
          </Link>
        )}
      </nav>
    </div>
  );
}

function pagerBtn(): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 8,
    border: `1px solid ${APP_BORDER}`,
    background: "#fff",
    color: "#334155",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 600,
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

function pagerDisabled(): React.CSSProperties {
  return {
    ...pagerBtn(),
    opacity: 0.45,
    pointerEvents: "none",
    cursor: "not-allowed",
  };
}
