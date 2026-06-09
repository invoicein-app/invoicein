"use client";

import { useEffect, useMemo, useState } from "react";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import {
  formPrimaryButton,
  tableActionDanger,
  tableActionSecondary,
} from "../../components/app-action-buttons";
import FormSubmitButton from "../../components/form-submit-button";
import { useSubmitGuard } from "../../components/use-submit-guard";
import { StatusToggle } from "../../components/status-toggle";
import { formatRibuanInput, parseRibuanInput, rupiah } from "@/lib/money";
import { monthKeyFromDate, monthStart } from "@/lib/invoice-totals";
import {
  RECURRING_FREQUENCIES,
  WEEKDAY_OPTIONS,
  labelFrequency,
  scheduleLabel,
  weekKeyFromDate,
  weekRangeFromKey,
  type RecurringFrequency,
} from "@/lib/expense-recurring";
import {
  expenseAlertBox,
  expenseTableWrap,
} from "../expense-page-styles";
import ExpenseSubPageShell from "../expense-subpage-shell";

type Template = {
  id: string;
  name: string;
  category: string;
  default_amount: number;
  frequency: RecurringFrequency;
  due_day_of_month: number | null;
  due_day_of_week: number | null;
  is_active: boolean;
  notes: string | null;
};

type ExpenseRow = {
  id: string;
  expense_date: string;
  recurring_template_id: string | null;
};

type TemplateForm = {
  name: string;
  category: string;
  default_amount: string;
  frequency: RecurringFrequency;
  due_day_of_month: string;
  due_day_of_week: string;
  is_active: boolean;
  notes: string;
};

const currentMonth = monthKeyFromDate(monthStart(new Date()));

function emptyTemplateForm(): TemplateForm {
  return {
    name: "",
    category: "gaji",
    default_amount: "",
    frequency: "monthly",
    due_day_of_month: "1",
    due_day_of_week: "",
    is_active: true,
    notes: "",
  };
}

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function RecurringExpensesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [monthExpenses, setMonthExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<TemplateForm>(emptyTemplateForm());
  const [saving, setSaving] = useState(false);
  const { tryBegin, end, isBlocked } = useSubmitGuard(setSaving);

  async function syncCurrentPeriod(): Promise<{ created: number; createdNames: string[] }> {
    const res = await fetch("/api/expense-recurring-templates/sync-period", {
      method: "POST",
      credentials: "include",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { created: 0, createdNames: [] };
    return { created: Number(json.created) || 0, createdNames: json.createdNames || [] };
  }

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const sync = await syncCurrentPeriod();
      const [tplRes, expRes] = await Promise.all([
        fetch("/api/expense-recurring-templates", { credentials: "include" }),
        fetch(`/api/expenses?month=${currentMonth}`, { credentials: "include" }),
      ]);
      const tplJson = await tplRes.json().catch(() => ({}));
      const expJson = await expRes.json().catch(() => ({}));
      if (!tplRes.ok) {
        setMsg(tplJson?.error || "Gagal memuat biaya bulanan.");
        return;
      }
      setTemplates(tplJson.templates || []);
      setMonthExpenses(expJson.expenses || []);
      if (sync.created > 0) {
        const names = sync.createdNames.slice(0, 3).join(", ");
        const more = sync.createdNames.length > 3 ? ` +${sync.createdNames.length - 3} lainnya` : "";
        setMsg(
          `Otomatis dicatat ke Pengeluaran (${sync.created}): ${names}${more}. Status awal: belum lunas.`
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const templateById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);

  const createdTemplateIds = useMemo(() => {
    const s = new Set<string>();
    const today = todayLocal();
    const weekRange = weekRangeFromKey(weekKeyFromDate(new Date()));
    for (const e of monthExpenses) {
      if (!e.recurring_template_id) continue;
      const tpl = templateById.get(e.recurring_template_id);
      const freq = tpl?.frequency || "monthly";
      if (freq === "monthly" && e.expense_date.startsWith(currentMonth)) {
        s.add(e.recurring_template_id);
      } else if (freq === "weekly" && weekRange && e.expense_date >= weekRange.start && e.expense_date <= weekRange.end) {
        s.add(e.recurring_template_id);
      } else if (freq === "daily" && e.expense_date === today) {
        s.add(e.recurring_template_id);
      }
    }
    return s;
  }, [monthExpenses, templateById]);

  function openCreate() {
    setMode("create");
    setEditingId("");
    setForm(emptyTemplateForm());
    setSheetOpen(true);
  }

  function openEdit(t: Template) {
    setMode("edit");
    setEditingId(t.id);
    setForm({
      name: t.name,
      category: t.category,
      default_amount: formatRibuanInput(t.default_amount),
      frequency: t.frequency || "monthly",
      due_day_of_month: t.due_day_of_month != null ? String(t.due_day_of_month) : "1",
      due_day_of_week: t.due_day_of_week != null ? String(t.due_day_of_week) : "",
      is_active: t.is_active,
      notes: t.notes || "",
    });
    setSheetOpen(true);
  }

  async function save() {
    if (isBlocked()) return;
    if (form.frequency === "weekly" && !form.due_day_of_week) {
      setMsg("Hari wajib dipilih untuk frekuensi mingguan.");
      return;
    }
    if (form.frequency === "monthly") {
      const d = Number(form.due_day_of_month);
      if (!Number.isFinite(d) || d < 1 || d > 31) {
        setMsg("Tanggal jatuh tempo harus 1–31.");
        return;
      }
    }

    setMsg("");
    if (!tryBegin()) return;
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        default_amount: parseRibuanInput(form.default_amount),
        frequency: form.frequency,
        due_day_of_month: form.frequency === "monthly" ? Number(form.due_day_of_month) : null,
        due_day_of_week:
          form.frequency === "weekly" && form.due_day_of_week ? Number(form.due_day_of_week) : null,
        is_active: form.is_active,
        notes: form.notes.trim() || null,
      };
      const url =
        mode === "create" ? "/api/expense-recurring-templates" : `/api/expense-recurring-templates/${editingId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.error || "Gagal menyimpan.");
        return;
      }
      setSheetOpen(false);
      await load();
    } finally {
      end();
    }
  }

  async function remove(id: string) {
    if (!confirm("Hapus template biaya bulanan ini?")) return;
    const res = await fetch(`/api/expense-recurring-templates/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(json?.error || "Gagal hapus.");
    await load();
  }

  return (
    <>
      <ExpenseSubPageShell
        title="Biaya Bulanan"
        subtitle={
          <>
            Template biaya tetap (harian, mingguan, bulanan). Template <b>Aktif</b> otomatis dicatat ke
            Pengeluaran per periode (status awal <b>belum lunas</b>). Nonaktifkan template jika minggu/bulan itu tidak
            ada biaya.
          </>
        }
        actions={
          <button type="button" onClick={openCreate} style={{ ...formPrimaryButton(), width: "100%" }}>
            + Tambah Biaya Bulanan
          </button>
        }
        cardTitle="Template Biaya Bulanan"
      >
        {msg ? <div style={expenseAlertBox()}>{msg}</div> : null}
        <div className="app-table-scroll" style={expenseTableWrap}>
          <table className="app-data-table app-table--expenses-recurring">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Kategori</th>
              <th>Frekuensi</th>
              <th>Nominal</th>
              <th>Jadwal</th>
              <th>Status</th>
              <th>Periode ini</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} data-label="">
                  Loading...
                </td>
              </tr>
            ) : templates.length === 0 ? (
              <tr>
                <td colSpan={8} data-label="" style={{ textAlign: "center", color: "#94a3b8" }}>
                  Belum ada biaya bulanan. Tambah gaji, wifi, listrik, sewa, dll.
                </td>
              </tr>
            ) : (
              templates.map((t) => {
                const alreadyCreated = createdTemplateIds.has(t.id);
                return (
                  <tr key={t.id}>
                    <td data-label="Nama">{t.name}</td>
                    <td data-label="Kategori" className="app-expense-recurring-col-optional">
                      {t.category}
                    </td>
                    <td data-label="Frekuensi" className="app-expense-recurring-col-optional">
                      {labelFrequency(t.frequency || "monthly")}
                    </td>
                    <td data-label="Nominal">{rupiah(Number(t.default_amount))}</td>
                    <td data-label="Jadwal">{scheduleLabel(t)}</td>
                    <td data-label="Status">{t.is_active ? "Aktif" : "Nonaktif"}</td>
                    <td data-label="Periode ini">
                      {!t.is_active ? (
                        <span style={{ color: "#94a3b8", fontSize: 12 }}>Nonaktif</span>
                      ) : alreadyCreated ? (
                        <span style={{ color: "#065f46", fontWeight: 600, fontSize: 12 }}>Sudah dicatat</span>
                      ) : (
                        <span style={{ color: "#b45309", fontWeight: 600, fontSize: 12 }}>Belum dicatat</span>
                      )}
                    </td>
                    <td data-label="Aksi" className="app-td-actions">
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => openEdit(t)} style={tableActionSecondary()}>
                          Ubah
                        </button>
                        <button type="button" onClick={() => remove(t.id)} style={tableActionDanger()}>
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </ExpenseSubPageShell>

      {sheetOpen ? (
        <div className="app-modal-backdrop" style={backdrop()}>
          <div className="app-modal-sheet" style={sheet()}>
            <h3 style={{ margin: 0 }}>{mode === "create" ? "Tambah Biaya Bulanan" : "Edit Biaya Bulanan"}</h3>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <label style={label()}>
                Nama
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input()} />
              </label>
              <label style={label()}>
                Kategori
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  style={input()}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label style={label()}>
                Nominal default (Rp)
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Contoh: 1.000.000"
                  value={form.default_amount}
                  onChange={(e) =>
                    setForm({ ...form, default_amount: formatRibuanInput(e.target.value) })
                  }
                  style={input()}
                />
              </label>
              <label style={label()}>
                Frekuensi
                <select
                  value={form.frequency}
                  onChange={(e) => {
                    const frequency = e.target.value as RecurringFrequency;
                    setForm({
                      ...form,
                      frequency,
                      due_day_of_week: frequency === "weekly" ? form.due_day_of_week : "",
                    });
                  }}
                  style={input()}
                >
                  {RECURRING_FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              {form.frequency === "weekly" ? (
                <label style={label()}>
                  Hari
                  <select
                    value={form.due_day_of_week}
                    onChange={(e) => setForm({ ...form, due_day_of_week: e.target.value })}
                    style={input()}
                    required
                  >
                    <option value="">— Pilih hari —</option>
                    {WEEKDAY_OPTIONS.map((w) => (
                      <option key={w.value} value={String(w.value)}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {form.frequency === "monthly" ? (
                <label style={label()}>
                  Tanggal jatuh tempo (1–31)
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={form.due_day_of_month}
                    onChange={(e) => setForm({ ...form, due_day_of_month: e.target.value })}
                    style={input()}
                  />
                </label>
              ) : null}
              <StatusToggle
                variant="form"
                active={form.is_active}
                disabled={saving}
                onChange={(is_active) => setForm({ ...form, is_active })}
              />
              <label style={label()}>
                Catatan (opsional)
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  style={{ ...input(), minHeight: 72 }}
                />
              </label>
              <div className="app-modal-sheet__actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setSheetOpen(false)} disabled={saving} style={tableActionSecondary()}>
                  Batal
                </button>
                <FormSubmitButton busy={saving} busyLabel="Menyimpan..." onClick={save}>
                  Simpan
                </FormSubmitButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 13, color: "#444", fontWeight: 600 };
}

function input(): React.CSSProperties {
  return { padding: 10, borderRadius: 8, border: "1px solid #ddd", width: "100%", boxSizing: "border-box" };
}

function backdrop(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.25)",
    display: "grid",
    placeItems: "center",
    padding: 16,
    zIndex: 1000,
  };
}

function sheet(): React.CSSProperties {
  return {
    width: "min(480px, 100%)",
    background: "white",
    borderRadius: 14,
    border: "1px solid #eee",
    padding: 16,
  };
}
