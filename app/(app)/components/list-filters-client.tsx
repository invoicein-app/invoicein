"use client";

/**
 * Filter bar dengan model sama seperti invoice list:
 * - Search input (optional)
 * - Per page select (optional)
 * - Reset button
 */
type Props = {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onReset?: () => void;
  perPage?: number;
  onPerPageChange?: (v: number) => void;
  perPageOptions?: number[];
  children?: React.ReactNode;
};

const labelStyle: React.CSSProperties = { fontSize: 12, color: "#666", marginBottom: 6 };
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 10px",
  borderRadius: 10,
  border: "1px solid #ddd",
  outline: "none",
  boxSizing: "border-box",
};
const selectStyle: React.CSSProperties = { ...inputStyle, background: "white" };
const btnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
  cursor: "pointer",
  fontWeight: 700,
  height: 40,
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
}: Props) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 260px", minWidth: 240 }}>
        <div style={labelStyle}>Cari</div>
        <input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          style={inputStyle}
        />
      </div>
      {onPerPageChange && perPageOptions.length > 0 ? (
        <div style={{ flex: "0 0 140px", minWidth: 130 }}>
          <div style={labelStyle}>Per halaman</div>
          <select
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            style={selectStyle}
          >
            {perPageOptions.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      ) : null}
      {onReset ? (
        <button type="button" onClick={onReset} style={btnStyle}>
          Reset
        </button>
      ) : null}
      {children}
    </div>
  );
}
