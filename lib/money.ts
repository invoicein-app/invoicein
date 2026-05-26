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