/**
 * Map & clean customer rows from Paper.id partners export (.xlsx).
 */

export type PaperIdRawRow = Record<string, unknown>;

export type MappedCustomerDraft = {
  name: string;
  phone: string | null;
  address: string | null;
  paperType: string;
};

export type ParseRowOutcome =
  | { ok: true; data: MappedCustomerDraft; excelRow: number }
  | { ok: false; excelRow: number; reason: string; name?: string };

export type ImportSummary = {
  totalRows: number;
  imported: number;
  skipped: number;
  failed: number;
  details: {
    excelRow: number;
    status: "imported" | "skipped" | "failed";
    name?: string;
    reason?: string;
  }[];
};

/** Paper.id Type values treated as customers for import. */
const CUSTOMER_TYPE_VALUES = new Set([
  "client",
  "customer",
  "pelanggan",
  "klien",
  "both",
  "client & supplier",
]);

export function cellStr(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    const s = String(value);
    return s.includes("e") || s.includes("E") ? s : String(Math.trunc(value) === value ? Math.trunc(value) : value);
  }
  return String(value).trim();
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizePhoneDigits(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

/**
 * Duplicate key for org-scoped dedupe.
 * - If phone present: normalized name + phone digits
 * - If phone empty: normalized name only
 */
export function duplicateKey(name: string, phone: string | null): string {
  const n = normalizeName(name);
  const p = normalizePhoneDigits(phone);
  return p ? `${n}::${p}` : `${n}::`;
}

export function combinePaperIdAddress(row: PaperIdRawRow): string | null {
  const parts = [
    cellStr(row["Alamat Baris 1"]),
    cellStr(row["Alamat Baris 2"]),
    cellStr(row["Kota/Kabupaten"]),
    cellStr(row["Provinsi"]),
    cellStr(row["Kode Pos"]),
    cellStr(row["Negara"]),
  ].filter(Boolean);

  if (parts.length === 0) return null;
  return parts.join(", ");
}

export function pickPhone(row: PaperIdRawRow): string | null {
  const mobile = cellStr(row["Telpon Seluler"]);
  const telp = cellStr(row["Telp"]);
  const chosen = mobile || telp;
  return chosen || null;
}

export function isCustomerType(typeRaw: string): boolean {
  const t = typeRaw.trim().toLowerCase();
  if (!t) return true;
  return CUSTOMER_TYPE_VALUES.has(t);
}

export function mapPaperIdRow(row: PaperIdRawRow, excelRow: number): ParseRowOutcome {
  const typeRaw = cellStr(row["Type"]);
  if (typeRaw && !isCustomerType(typeRaw)) {
    return {
      ok: false,
      excelRow,
      reason: `Tipe "${typeRaw}" bukan customer (hanya Client/Both diimpor)`,
      name: cellStr(row["Nama"]) || undefined,
    };
  }

  const name = cellStr(row["Nama"]);
  if (!name) {
    return { ok: false, excelRow, reason: "Nama wajib (kosong)" };
  }

  const phone = pickPhone(row);
  const address = combinePaperIdAddress(row);

  return {
    ok: true,
    excelRow,
    data: {
      name,
      phone,
      address,
      paperType: typeRaw || "Client",
    },
  };
}

export function parsePaperIdCustomerRows(rawRows: PaperIdRawRow[]): {
  valid: MappedCustomerDraft[];
  outcomes: ParseRowOutcome[];
} {
  const valid: MappedCustomerDraft[] = [];
  const outcomes: ParseRowOutcome[] = [];

  rawRows.forEach((row, idx) => {
    const excelRow = idx + 2;
    const mapped = mapPaperIdRow(row, excelRow);
    outcomes.push(mapped);
    if (mapped.ok) valid.push(mapped.data);
  });

  return { valid, outcomes };
}

export function dedupeMappedCustomers(
  drafts: MappedCustomerDraft[],
  existingKeys: Set<string>
): {
  toInsert: MappedCustomerDraft[];
  skippedInFile: number;
  skippedExisting: number;
  seenKeys: Set<string>;
} {
  const seenKeys = new Set<string>();
  const toInsert: MappedCustomerDraft[] = [];
  let skippedInFile = 0;
  let skippedExisting = 0;

  for (const d of drafts) {
    const key = duplicateKey(d.name, d.phone);
    if (seenKeys.has(key)) {
      skippedInFile++;
      continue;
    }
    if (existingKeys.has(key)) {
      skippedExisting++;
      seenKeys.add(key);
      continue;
    }
    seenKeys.add(key);
    toInsert.push(d);
  }

  return { toInsert, skippedInFile, skippedExisting, seenKeys };
}

export function buildExistingKeySet(
  rows: { name: string; phone: string | null }[]
): Set<string> {
  const set = new Set<string>();
  for (const r of rows) {
    set.add(duplicateKey(r.name, r.phone));
  }
  return set;
}
