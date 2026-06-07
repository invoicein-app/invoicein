export function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export function num(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** Input nominal: tampilkan pemisah ribuan titik (1000000 → 1.000.000). */
export function formatRibuanInput(raw: string | number): string {
  const digits =
    typeof raw === "number"
      ? String(Math.max(0, Math.floor(Number.isFinite(raw) ? raw : 0)))
      : String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Parse input berformat ribuan ke angka bulat. */
export function parseRibuanInput(raw: string): number {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

/** Sanitize qty while typing: digits + at most one dot (comma auto → dot). */
export function sanitizeQtyInput(raw: string): string {
  const normalized = String(raw ?? "").replace(/,/g, ".");
  const s = normalized.replace(/[^\d.]/g, "");
  if (!s) return "";

  let seenDot = false;
  let out = "";
  for (const ch of s) {
    if (ch === ".") {
      if (seenDot) continue;
      seenDot = true;
      out += ch;
    } else {
      out += ch;
    }
  }
  return out;
}

/** Parse qty text (e.g. 1.5) to number. */
export function parseQtyInput(raw: string): number {
  const t = sanitizeQtyInput(String(raw ?? "").trim());
  if (t === "" || t === ".") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** Format qty for input display (always dot as decimal separator). */
export function formatQtyInput(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  if (Number.isInteger(n)) return String(n);
  return String(n)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
}
