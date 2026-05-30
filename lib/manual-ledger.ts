export type ManualEntryType = "receivable" | "payable";
export type PartySourceType = "customer" | "vendor" | "other";
export type ManualLedgerStatus = "BELUM_DIBAYAR" | "SEBAGIAN" | "LUNAS" | "LEWAT_JATUH_TEMPO";

export function toYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isManualEntryType(v: string): v is ManualEntryType {
  return v === "receivable" || v === "payable";
}

export function isPartySourceType(v: string): v is PartySourceType {
  return v === "customer" || v === "vendor" || v === "other";
}

export function calcRemaining(total: number, paid: number) {
  return Math.max(0, total - paid);
}

export function deriveManualLedgerStatus(args: {
  totalAmount: number;
  paidAmount: number;
  dueDate?: string | null;
  today?: string;
}): ManualLedgerStatus {
  const remaining = calcRemaining(args.totalAmount, args.paidAmount);
  if (remaining <= 0) return "LUNAS";
  const today = args.today || toYmd();
  if (args.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(args.dueDate) && args.dueDate < today) {
    return "LEWAT_JATUH_TEMPO";
  }
  if (args.paidAmount > 0) return "SEBAGIAN";
  return "BELUM_DIBAYAR";
}

export function labelManualLedgerStatus(v: ManualLedgerStatus) {
  if (v === "LUNAS") return "Lunas";
  if (v === "SEBAGIAN") return "Sebagian";
  if (v === "LEWAT_JATUH_TEMPO") return "Lewat Jatuh Tempo";
  return "Belum Dibayar";
}
