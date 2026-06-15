export type DeliveryNoteStatusKey = "draft" | "posted" | "cancelled" | string;

export function normalizeDeliveryNoteStatus(status: unknown): string {
  return String(status || "draft").trim().toLowerCase();
}

export function deliveryNoteStatusLabel(status: unknown): string {
  const s = normalizeDeliveryNoteStatus(status);
  if (s === "posted") return "TERCATAT";
  if (s === "cancelled") return "DIBATALKAN";
  if (s === "draft") return "DRAFT";
  return s.toUpperCase();
}

export function deliveryNoteStatusBadge(status: unknown): {
  bg: string;
  border: string;
  color: string;
  label: string;
} {
  const s = normalizeDeliveryNoteStatus(status);
  if (s === "posted") {
    return { bg: "#ecfdf5", border: "#6ee7b7", color: "#065f46", label: "TERCATAT" };
  }
  if (s === "cancelled") {
    return { bg: "#fef2f2", border: "#fca5a5", color: "#991b1b", label: "DIBATALKAN" };
  }
  return { bg: "#fff7ed", border: "#fdba74", color: "#9a3412", label: "DRAFT" };
}

export function isLegacyDraftDeliveryNote(status: unknown): boolean {
  return normalizeDeliveryNoteStatus(status) === "draft";
}
