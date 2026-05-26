import type { SupabaseClient } from "@supabase/supabase-js";
import { monthKeyFromDate, monthStart } from "@/lib/invoice-totals";
import {
  expenseDateForIsoWeekdayInWeek,
  expenseDateForMonth,
  isIsoWeekday,
  weekKeyFromDate,
  weekRangeFromKey,
  type RecurringFrequency,
} from "@/lib/expense-recurring";

export type RecurringTemplateRow = {
  id: string;
  org_id: string;
  name: string;
  category: string;
  default_amount: number;
  frequency: string | null;
  due_day_of_month: number | null;
  due_day_of_week: number | null;
  is_active: boolean;
  notes: string | null;
};

export type CreateFromTemplateResult =
  | { status: "created"; expense: Record<string, unknown> }
  | { status: "exists" }
  | { status: "skipped"; reason: string }
  | { status: "error"; error: string };

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function createExpenseFromRecurringTemplate(
  supabase: SupabaseClient,
  orgId: string,
  template: RecurringTemplateRow,
  opts?: { month?: string; week?: string; date?: string; referenceDate?: Date }
): Promise<CreateFromTemplateResult> {
  if (!template.is_active) {
    return { status: "skipped", reason: "Template tidak aktif." };
  }

  const today = opts?.referenceDate ?? new Date();
  const monthKey =
    typeof opts?.month === "string" && /^\d{4}-\d{2}$/.test(opts.month)
      ? opts.month
      : monthKeyFromDate(monthStart(today));

  const frequency = (template.frequency || "monthly") as RecurringFrequency;
  const [y, m] = monthKey.split("-").map(Number);

  let expense_date: string;
  let periodLabel: string;
  let dupStart: string;
  let dupEnd: string;

  if (frequency === "monthly") {
    if (!template.due_day_of_month) {
      return { status: "skipped", reason: "Tanggal jatuh tempo belum diisi." };
    }
    const start = `${monthKey}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${monthKey}-${String(lastDay).padStart(2, "0")}`;
    expense_date = expenseDateForMonth(y, m, template.due_day_of_month);
    periodLabel = monthKey;
    dupStart = start;
    dupEnd = end;
  } else if (frequency === "weekly") {
    if (!isIsoWeekday(Number(template.due_day_of_week))) {
      return { status: "skipped", reason: "Hari mingguan belum diisi." };
    }
    const weekKey =
      typeof opts?.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(opts.week)
        ? opts.week
        : weekKeyFromDate(today);
    const range = weekRangeFromKey(weekKey);
    if (!range) return { status: "error", error: "Minggu tidak valid." };
    expense_date = expenseDateForIsoWeekdayInWeek(new Date(`${weekKey}T12:00:00`), template.due_day_of_week!);
    periodLabel = `minggu ${weekKey}`;
    dupStart = range.start;
    dupEnd = range.end;
  } else {
    const expenseDay =
      typeof opts?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) ? opts.date : todayLocal();
    expense_date = expenseDay;
    periodLabel = expenseDay;
    dupStart = expenseDay;
    dupEnd = expenseDay;
  }

  const { data: existing, error: existErr } = await supabase
    .from("expenses")
    .select("id")
    .eq("org_id", orgId)
    .eq("recurring_template_id", template.id)
    .gte("expense_date", dupStart)
    .lte("expense_date", dupEnd)
    .limit(1)
    .maybeSingle();

  if (existErr) return { status: "error", error: existErr.message };
  if (existing) return { status: "exists" };

  const { data: row, error } = await supabase
    .from("expenses")
    .insert({
      org_id: orgId,
      expense_date,
      category: template.category,
      description: `${template.name} (${periodLabel})`,
      amount: template.default_amount,
      payment_status: "unpaid",
      payment_method: null,
      notes: template.notes,
      recurring_template_id: template.id,
    })
    .select("*")
    .single();

  if (error) return { status: "error", error: error.message };
  return { status: "created", expense: row as Record<string, unknown> };
}
