/** Kategori pengeluaran operasional — daftar tetap sederhana untuk UMKM. */
export const EXPENSE_CATEGORIES = [
  "bahan baku",
  "ongkir",
  "gaji",
  "listrik",
  "air",
  "wifi",
  "sewa",
  "operasional",
  "bbm",
  "administrasi",
  "lain-lain",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function isExpenseCategory(v: string): v is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(v);
}

export function labelPaymentStatus(status: string): string {
  return status === "paid" ? "Sudah lunas" : "Belum lunas";
}

export function badgePaymentStatus(status: string): { bg: string; border: string; color: string; label: string } {
  if (status === "paid") {
    return { bg: "#ecfdf5", border: "#6ee7b7", color: "#065f46", label: "Sudah lunas" };
  }
  return { bg: "#fff7ed", border: "#fdba74", color: "#9a3412", label: "Belum lunas" };
}

/** Metode pembayaran standar (opsional). Nilai disimpan = label. */
export const EXPENSE_PAYMENT_METHODS = ["Transfer", "Tunai", "E-Wallet"] as const;

export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];

const LEGACY_PAYMENT_METHOD_PREFIX = "__legacy__:";

export function isExpensePaymentMethod(v: string): v is ExpensePaymentMethod {
  return (EXPENSE_PAYMENT_METHODS as readonly string[]).includes(v);
}

/** Normalisasi teks bebas / variasi umum ke nilai standar. */
export function canonicalizeExpensePaymentMethod(raw: string): ExpensePaymentMethod | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!s) return null;
  for (const m of EXPENSE_PAYMENT_METHODS) {
    if (m.toLowerCase() === s) return m;
  }
  if (s === "transfer" || s.includes("transfer") || s === "tf" || s === "bank") return "Transfer";
  if (s === "tunai" || s === "cash" || s === "kas") return "Tunai";
  if (s === "e-wallet" || s === "ewallet" || s === "e wallet" || s.includes("wallet") || s === "qris")
    return "E-Wallet";
  return null;
}

/** Tampilan tabel: standar atau teks lama apa adanya. */
export function labelExpensePaymentMethod(v: string | null | undefined): string {
  if (!v) return "—";
  return canonicalizeExpensePaymentMethod(v) ?? v;
}

/** Nilai untuk select form (termasuk opsi data lama). */
export function expensePaymentMethodFormValue(stored: string | null | undefined): string {
  if (!stored) return "";
  const canon = canonicalizeExpensePaymentMethod(stored);
  if (canon) return canon;
  return `${LEGACY_PAYMENT_METHOD_PREFIX}${stored}`;
}

export function expensePaymentMethodFromForm(value: string): string | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  if (v.startsWith(LEGACY_PAYMENT_METHOD_PREFIX)) {
    return v.slice(LEGACY_PAYMENT_METHOD_PREFIX.length) || null;
  }
  const canon = canonicalizeExpensePaymentMethod(v);
  return canon ?? (isExpensePaymentMethod(v) ? v : null);
}

export function isLegacyExpensePaymentMethodFormValue(value: string): boolean {
  return value.startsWith(LEGACY_PAYMENT_METHOD_PREFIX);
}

export function legacyExpensePaymentMethodLabel(value: string): string {
  return value.slice(LEGACY_PAYMENT_METHOD_PREFIX.length);
}

/** Filter daftar: nilai query `payment_method` yang valid (label standar). */
export function parseExpensePaymentMethodFilter(raw: unknown): ExpensePaymentMethod | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (isExpensePaymentMethod(s)) return s;
  return canonicalizeExpensePaymentMethod(s);
}

/** Klausa Supabase `.or(...)` untuk filter metode (termasuk teks lama umum). */
export function expensePaymentMethodFilterOrClause(method: ExpensePaymentMethod): string {
  if (method === "Transfer") {
    return "payment_method.eq.Transfer,payment_method.ilike.%transfer%";
  }
  if (method === "Tunai") {
    return "payment_method.eq.Tunai,payment_method.ilike.%tunai%,payment_method.ilike.%cash%,payment_method.ilike.%kas%";
  }
  return "payment_method.eq.E-Wallet,payment_method.ilike.%wallet%,payment_method.ilike.%qris%,payment_method.ilike.%e-wallet%";
}

/** API: kosong → null; standar → kanonik; selain itu tetap (data lama). */
export function parseExpensePaymentMethodInput(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const canon = canonicalizeExpensePaymentMethod(s);
  if (canon) return canon;
  if (isExpensePaymentMethod(s)) return s;
  return s;
}
