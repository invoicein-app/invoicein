"use client";

import { APP_BORDER, APP_TEAL } from "./app-ui-tokens";

type Props = {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onReset?: () => void;
  perPage?: number;
  onPerPageChange?: (v: number) => void;
  perPageOptions?: number[];
  children?: React.ReactNode;
  /** Sembunyikan dropdown per halaman (dipakai saat kontrol ada di footer layout) */
  hidePerPage?: boolean;
};

const FILTER_CONTROL_HEIGHT = 44;

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: FILTER_CONTROL_HEIGHT,
  padding: "0 40px 0 14px",
  borderRadius: 8,
  border: `1px solid ${APP_BORDER}`,
  outline: "none",
  boxSizing: "border-box",
  fontSize: 14,
  background: "#fff",
};

const selectStyle: React.CSSProperties = {
  height: FILTER_CONTROL_HEIGHT,
  minWidth: 72,
  padding: "0 12px",
  borderRadius: 8,
  border: `1px solid ${APP_BORDER}`,
  outline: "none",
  boxSizing: "border-box",
  fontSize: 14,
  fontWeight: 700,
  color: "#333",
  background: "#fff",
  cursor: "pointer",
};

const perPageLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#64748b",
  whiteSpace: "nowrap",
};

const resetBtn: React.CSSProperties = {
  padding: "0 16px",
  borderRadius: 8,
  border: `2px solid ${APP_TEAL}`,
  background: "#fff",
  color: APP_TEAL,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
  height: FILTER_CONTROL_HEIGHT,
  boxSizing: "border-box",
  flex: "0 0 auto",
};

export default function ListFiltersClient({
  searchPlaceholder = "Cari...",
  searchValue,
  onSearchChange,
  onReset,
  perPage = 20,
  onPerPageChange,
  perPageOptions = [10, 20, 30, 50],
  children,
  hidePerPage = false,
}: Props) {
  return (
    <div className="app-filter-bar" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div className="app-filter-bar__search" style={{ flex: "1 1 280px", minWidth: 0, position: "relative" }}>
        <input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          style={inputStyle}
          aria-label="Cari"
        />
        <span
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            color: "#94a3b8",
          }}
          aria-hidden
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      </div>

      {!hidePerPage && onPerPageChange && perPageOptions.length > 0 ? (
        <div className="app-filter-bar__per-page" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <label htmlFor="list-filter-ps" style={perPageLabelStyle}>
            Per halaman
          </label>
          <select
            id="list-filter-ps"
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            style={selectStyle}
            aria-label="Jumlah baris per halaman"
          >
            {perPageOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {onReset ? (
        <button type="button" onClick={onReset} style={resetBtn}>
          Reset
        </button>
      ) : null}

      {children}
    </div>
  );
}
