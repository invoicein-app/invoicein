/** Class names for app-unified-list-table.css (selaras Surat Jalan). */

export const ul = {
  scroll: "app-unified-table-scroll",
  table: "app-unified-list-table",
  th: "ul-th",
  thCenter: "ul-th ul-th--center",
  thRight: "ul-th ul-th--right",
  td: "ul-td",
  tdTop: "ul-td ul-td--top",
  tdCenter: "ul-td ul-td--center",
  tdRight: "ul-td ul-td--right",
  loading: "ul-td ul-td--loading",
  primaryLink: "ul-primary-link",
  primaryText: "ul-primary-text",
  primaryMeta: "ul-primary-meta",
  cellMuted: "ul-cell-muted",
  money: "ul-money",
  statusBadge: "ul-status-badge",
  tag: "ul-tag",
  actions: "ul-actions",
} as const;

export function formatTanggalIndo(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
