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

/** Tombol Kembali di header halaman buat (invoice / quotation / SJ). */
export function formPageBackLink(): CSSProperties {
  return {
    padding: "10px 20px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#111827",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
    flexShrink: 0,
    boxSizing: "border-box",
  };
}

/** Tombol Simpan utama di header halaman buat — tema hijau. */
export function formPageSaveButton(): CSSProperties {
  return {
    padding: "10px 20px",
    borderRadius: 12,
    border: `1px solid ${TEAL}`,
    background: TEAL,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxSizing: "border-box",
  };
}

export function formPageSaveButtonDisabled(): CSSProperties {
  return {
    ...formPageSaveButton(),
    opacity: 0.55,
    cursor: "not-allowed",
  };
}

/** Wrapper aksi kanan header form (Kembali + Simpan). */
export function formPageHeaderActions(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  };
}

/** Alias — tombol/link sekunder putih (Edit, Preview, Dotmatrix). */
export function formPageSoftLink(): CSSProperties {
  return formPageBackLink();
}

/** CTA utama hijau untuk link (Download PDF, GRN, Convert). */
export function formPagePrimaryLink(): CSSProperties {
  return {
    ...formPageSaveButton(),
    textDecoration: "none",
  };
}

/** Tombol utama hijau di halaman detail (Post, Send Invoice). */
export function formPagePrimaryButton(): CSSProperties {
  return formPageSaveButton();
}

export function formPagePrimaryButtonDisabled(): CSSProperties {
  return formPageSaveButtonDisabled();
}

/** Tombol bahaya (Cancel, Delete). */
export function formPageDangerButton(): CSSProperties {
  return {
    padding: "10px 20px",
    borderRadius: 12,
    border: "1px solid #fca5a5",
    background: "#fef2f2",
    color: "#991b1b",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxSizing: "border-box",
  };
}

export function formPageDangerButtonDisabled(): CSSProperties {
  return {
    ...formPageDangerButton(),
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    color: "#9ca3af",
    cursor: "not-allowed",
    opacity: 0.75,
  };
}

export function formPageMutedButton(): CSSProperties {
  return {
    padding: "10px 20px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#f3f4f6",
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: 600,
    cursor: "not-allowed",
    whiteSpace: "nowrap",
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

/** Tombol primer di toolbar / modal — selaras formPageSaveButton. */
export function formPrimaryButton(): CSSProperties {
  return formPageSaveButton();
}
