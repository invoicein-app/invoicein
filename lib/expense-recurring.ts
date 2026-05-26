export const RECURRING_FREQUENCIES = [
  { value: "daily", label: "Harian" },
  { value: "weekly", label: "Mingguan" },
  { value: "monthly", label: "Bulanan" },
] as const;

export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number]["value"];

/** 1 = Senin … 7 = Minggu (ISO). */
export const WEEKDAY_OPTIONS = [
  { value: 1, label: "Senin" },
  { value: 2, label: "Selasa" },
  { value: 3, label: "Rabu" },
  { value: 4, label: "Kamis" },
  { value: 5, label: "Jumat" },
  { value: 6, label: "Sabtu" },
  { value: 7, label: "Minggu" },
] as const;

export type IsoWeekday = (typeof WEEKDAY_OPTIONS)[number]["value"];

export function isRecurringFrequency(v: string): v is RecurringFrequency {
  return v === "daily" || v === "weekly" || v === "monthly";
}

export function isIsoWeekday(n: number): n is IsoWeekday {
  return Number.isInteger(n) && n >= 1 && n <= 7;
}

export function labelFrequency(freq: string): string {
  return RECURRING_FREQUENCIES.find((f) => f.value === freq)?.label ?? freq;
}

export function labelWeekday(day: number): string {
  return WEEKDAY_OPTIONS.find((w) => w.value === day)?.label ?? `Hari ${day}`;
}

export function scheduleLabel(template: {
  frequency: string;
  due_day_of_month?: number | null;
  due_day_of_week?: number | null;
}): string {
  if (template.frequency === "weekly" && template.due_day_of_week) {
    return `Setiap ${labelWeekday(template.due_day_of_week)}`;
  }
  if (template.frequency === "monthly" && template.due_day_of_month) {
    return `Tgl ${template.due_day_of_month}`;
  }
  if (template.frequency === "daily") return "Harian";
  return "—";
}

export type RecurringTemplateInput = {
  name: string;
  category: string;
  default_amount: number;
  frequency: RecurringFrequency;
  due_day_of_month: number | null;
  due_day_of_week: number | null;
  is_active: boolean;
  notes: string | null;
};

export function normalizeRecurringTemplateBody(
  body: Record<string, unknown>,
  opts?: { partial?: boolean; existingFrequency?: RecurringFrequency }
): { ok: true; data: Partial<RecurringTemplateInput> } | { ok: false; error: string } {
  const partial = opts?.partial === true;
  const out: Partial<RecurringTemplateInput> = {};

  if (body.name !== undefined || !partial) {
    const name = String(body.name ?? "").trim();
    if (!name) return { ok: false, error: "Nama wajib diisi." };
    out.name = name;
  }

  if (body.frequency !== undefined || !partial) {
    const frequency = String(body.frequency ?? opts?.existingFrequency ?? "monthly").trim();
    if (!isRecurringFrequency(frequency)) {
      return { ok: false, error: "Frekuensi tidak valid." };
    }
    out.frequency = frequency;
  }

  const frequency = (out.frequency ?? opts?.existingFrequency ?? "monthly") as RecurringFrequency;

  if (body.due_day_of_month !== undefined || (!partial && frequency === "monthly")) {
    if (frequency !== "monthly") {
      out.due_day_of_month = null;
    } else {
      const d = Math.floor(Number(body.due_day_of_month));
      if (!Number.isFinite(d) || d < 1 || d > 31) {
        return { ok: false, error: "Tanggal jatuh tempo harus 1–31." };
      }
      out.due_day_of_month = d;
    }
  }

  if (body.due_day_of_week !== undefined || (!partial && frequency === "weekly")) {
    if (frequency !== "weekly") {
      out.due_day_of_week = null;
    } else {
      const raw = body.due_day_of_week;
      const w =
        raw === "" || raw === null || raw === undefined ? NaN : Math.floor(Number(raw));
      if (!isIsoWeekday(w)) {
        return { ok: false, error: "Hari wajib dipilih untuk frekuensi mingguan." };
      }
      out.due_day_of_week = w;
    }
  }

  if (!partial && frequency === "weekly" && !isIsoWeekday(Number(out.due_day_of_week))) {
    return { ok: false, error: "Hari wajib dipilih untuk frekuensi mingguan." };
  }

  if (!partial && frequency === "monthly" && (out.due_day_of_month == null || out.due_day_of_month < 1)) {
    return { ok: false, error: "Tanggal jatuh tempo harus 1–31." };
  }

  if (!partial && frequency === "daily") {
    out.due_day_of_month = null;
    out.due_day_of_week = null;
  }

  if (body.default_amount !== undefined || !partial) {
    const default_amount = Math.max(0, Number(body.default_amount));
    if (!Number.isFinite(default_amount) || default_amount <= 0) {
      return { ok: false, error: "Nominal default harus > 0." };
    }
    out.default_amount = default_amount;
  }

  if (body.is_active !== undefined || !partial) {
    out.is_active = body.is_active === false ? false : true;
  }

  if (body.notes !== undefined || !partial) {
    const notes = String(body.notes ?? "").trim();
    out.notes = notes || null;
  }

  return { ok: true, data: out };
}

export function validateRecurringTemplateState(row: {
  frequency: RecurringFrequency;
  due_day_of_month?: number | null;
  due_day_of_week?: number | null;
}): string | null {
  if (row.frequency === "weekly") {
    if (!isIsoWeekday(Number(row.due_day_of_week))) {
      return "Hari wajib dipilih untuk frekuensi mingguan.";
    }
  }
  if (row.frequency === "monthly") {
    const d = row.due_day_of_month;
    if (d == null || d < 1 || d > 31) return "Tanggal jatuh tempo harus 1–31.";
  }
  return null;
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Senin sebagai awal minggu (umum di ID). */
export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const js = x.getDay();
  const diff = js === 0 ? -6 : 1 - js;
  x.setDate(x.getDate() + diff);
  return x;
}

export function weekKeyFromDate(d: Date): string {
  return formatLocalDate(startOfWeekMonday(d));
}

export function expenseDateForIsoWeekdayInWeek(ref: Date, isoWeekday: number): string {
  const mon = startOfWeekMonday(ref);
  const target = new Date(mon);
  target.setDate(mon.getDate() + (isoWeekday - 1));
  return formatLocalDate(target);
}

export function expenseDateForMonth(year: number, month: number, dueDay: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(1, dueDay), lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function weekRangeFromKey(weekKey: string): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekKey)) return null;
  const mon = new Date(`${weekKey}T12:00:00`);
  if (Number.isNaN(mon.getTime())) return null;
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: weekKey, end: formatLocalDate(sun) };
}
