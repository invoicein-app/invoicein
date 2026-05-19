import type { CSSProperties } from "react";

/** Selaras dengan `invoice/invoice-actions-client.tsx` — aksi tabel & form. */
const TEAL = "#2D7D71";
const TEAL_SOFT = "#e8f4f3";

/** Primary: hijau solid (contoh: BAYAR, CTA utama). */
export function tableActionPrimary(): CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.06em",
    border: `1px solid ${TEAL}`,
    background: TEAL,
    color: "white",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
  };
}

/** Secondary: outline hijau (contoh: Ubah, View, Cancel). */
export function tableActionSecondary(): CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    border: `1px solid ${TEAL}`,
    background: "#fff",
    color: TEAL,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    boxSizing: "border-box",
  };
}

/** Secondary lembut (opsional): latar mint sangat halus + teks teal — jarang dipakai. */
export function tableActionSecondarySoft(): CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    border: `1px solid ${TEAL}`,
    background: TEAL_SOFT,
    color: TEAL,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
}

export function tableActionSecondaryDisabled(): CSSProperties {
  return {
    ...tableActionSecondarySoft(),
    cursor: "not-allowed",
    opacity: 0.7,
  };
}

/** Danger: merah (Hapus). */
export function tableActionDanger(): CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid #ffcdd2",
    background: "#fff5f5",
    color: "#c62828",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    boxSizing: "border-box",
  };
}

/** Disabled / muted (Prev pagination, tombol nonaktif). */
export function tableActionDisabled(): CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid #e2e8f0",
    background: "#f1f5f9",
    color: "#94a3b8",
    cursor: "not-allowed",
    whiteSpace: "nowrap",
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
  };
}

/** Link/tombol netral sekunder di toolbar (Refresh) — outline teal tipis. */
export function toolbarButtonOutline(): CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 8,
    border: `1px solid ${TEAL}`,
    background: "#fff",
    color: TEAL,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontSize: 14,
  };
}

/** Tombol primer di toolbar / modal (sedikit lebih besar dari aksi tabel). */
export function formPrimaryButton(): CSSProperties {
  return {
    padding: "10px 18px",
    borderRadius: 8,
    border: `1px solid ${TEAL}`,
    background: TEAL,
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  };
}
