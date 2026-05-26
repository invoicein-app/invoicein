"use client";

import { useEffect, useMemo, useState } from "react";
import ListPageLayout from "../components/list-page-layout";
import ListFiltersClient from "../components/list-filters-client";
import { listTableStyles } from "../components/list-page-layout";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  badgePaymentStatus,
  expensePaymentMethodFormValue,
  expensePaymentMethodFromForm,
  isLegacyExpensePaymentMethodFormValue,
  labelExpensePaymentMethod,
  labelPaymentStatus,
  legacyExpensePaymentMethodLabel,
} from "@/lib/expense-categories";
import {
  formPrimaryButton,
  tableActionDanger,
  tableActionPrimary,
  tableActionSecondary,
} from "../components/app-action-buttons";
import { formatRibuanInput, parseRibuanInput, rupiah } from "@/lib/money";
import { monthKeyFromDate, monthStart } from "@/lib/invoice-totals";

type ExpenseRow = {
  id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  payment_status: string;
  payment_method: string | null;
  notes: string | null;
  recurring_template_id: string | null;
};

type ExpenseForm = {
  expense_date: string;
  category: string;
  description: string;
  amount: string;
  payment_status: "paid" | "unpaid";
  payment_method: string;
  notes: string;
};

const defaultMonth = monthKeyFromDate(monthStart(new Date()));

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyForm(): ExpenseForm {
  return {
    expense_date: todayIso(),
    category: "operasional",
    description: "",
    amount: "",
    payment_status: "paid",
    payment_method: "",
    notes: "",
  };
}

export default function ExpensesPage() {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [month, setMonth] = useState(defaultMonth);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<ExpenseForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      await fetch("/api/expense-recurring-templates/sync-period", {
        method: "POST",
        credentials: "include",
      }).catch(() => null);

      const params = new URLSearchParams({ month });
      if (categoryFilter) params.set("category", categoryFilter);
      if (statusFilter) params.set("payment_status", statusFilter);
      if (methodFilter) params.set("payment_method", methodFilter);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/expenses?${params}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.error || "Gagal memuat pengeluaran.");
        setRows([]);
        return;
      }
      setRows(json.expenses || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, categoryFilter, statusFilter, methodFilter]);

  useEffect(() => {
    const t = setTimeout(() => load(), q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const filtered = rows;
  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const fromIdx = (page - 1) * pageSize;
  const paginated = useMemo(() => filtered.slice(fromIdx, fromIdx + pageSize), [filtered, fromIdx, pageSize]);

  function openCreate() {
    setMode("create");
    setEditingId("");
    setForm(emptyForm());
    setSheetOpen(true);
  }

  function openEdit(row: ExpenseRow) {
    setMode("edit");
    setEditingId(row.id);
    setForm({
      expense_date: row.expense_date?.slice(0, 10) || todayIso(),
      category: row.category,
      description: row.description,
      amount: formatRibuanInput(row.amount),
      payment_status: row.payment_status === "unpaid" ? "unpaid" : "paid",
      payment_method: expensePaymentMethodFormValue(row.payment_method),
      notes: row.notes || "",
    });
    setSheetOpen(true);
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const payload = {
        expense_date: form.expense_date,
        category: form.category,
        description: form.description.trim(),
        amount: parseRibuanInput(form.amount),
        payment_status: form.payment_status,
        payment_method: expensePaymentMethodFromForm(form.payment_method),
        notes: form.notes.trim() || null,
      };
      const url = mode === "create" ? "/api/expenses" : `/api/expenses/${editingId}`;
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
      setSaving(false);
    }
  }

  async function markPaid(id: string) {
    setMsg("");
    const res = await fetch(`/api/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ payment_status: "paid" }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(json?.error || "Gagal update status.");
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Hapus pengeluaran ini?")) return;
    setMsg("");
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE", credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(json?.error || "Gagal hapus.");
    await load();
  }

  const clientPagination = useMemo(
    () => ({
      onFirst: () => setPage(1),
      onPrev: () => setPage((p) => Math.max(1, p - 1)),
      onNext: () => setPage((p) => Math.min(totalPages, p + 1)),
      onLast: () => setPage(totalPages),
    }),
    [totalPages]
  );

  const filters = (
    <ListFiltersClient
      searchPlaceholder="Cari deskripsi / catatan..."
      searchValue={q}
      onSearchChange={setQ}
      onReset={() => {
        setQ("");
        setCategoryFilter("");
        setStatusFilter("");
        setMethodFilter("");
        setMonth(defaultMonth);
        setPage(1);
      }}
      perPage={pageSize}
      onPerPageChange={(v) => {
        setPageSize(v);
        setPage(1);
      }}
      perPageOptions={[10, 20, 30, 50]}
      hidePerPage
    >
      <input
        type="month"
        value={month}
        onChange={(e) => {
          setMonth(e.target.value);
          setPage(1);
        }}
        style={filterInput()}
      />
      <select
        value={categoryFilter}
        onChange={(e) => {
          setCategoryFilter(e.target.value);
          setPage(1);
        }}
        style={filterInput()}
      >
        <option value="">Semua kategori</option>
        {EXPENSE_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select
        value={statusFilter}
        onChange={(e) => {
          setStatusFilter(e.target.value);
          setPage(1);
        }}
        style={filterInput()}
      >
        <option value="">Semua status</option>
        <option value="paid">Sudah lunas</option>
        <option value="unpaid">Belum lunas</option>
      </select>
      <select
        value={methodFilter}
        onChange={(e) => {
          setMethodFilter(e.target.value);
          setPage(1);
        }}
        style={filterInput()}
        aria-label="Metode pembayaran"
      >
        <option value="">Semua metode</option>
        {EXPENSE_PAYMENT_METHODS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <button type="button" onClick={openCreate} style={formPrimaryButton()}>
        + Catat Pengeluaran
      </button>
    </ListFiltersClient>
  );

  const tableContent = (
    <table style={listTableStyles.table}>
      <thead>
        <tr style={listTableStyles.thead}>
          <th style={listTableStyles.th}>Tanggal</th>
          <th style={listTableStyles.th}>Kategori</th>
          <th style={listTableStyles.th}>Deskripsi</th>
          <th style={{ ...listTableStyles.th, textAlign: "right" }}>Nominal</th>
          <th style={listTableStyles.th}>Status</th>
          <th style={listTableStyles.th}>Metode pembayaran</th>
          <th style={listTableStyles.th}>Sumber</th>
          <th style={listTableStyles.th}>Aksi</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={8} style={listTableStyles.td}>
              Loading...
            </td>
          </tr>
        ) : paginated.length === 0 ? (
          <tr>
            <td colSpan={8} style={listTableStyles.empty}>
              Belum ada pengeluaran untuk filter ini.
            </td>
          </tr>
        ) : (
          paginated.map((r) => {
            const badge = badgePaymentStatus(r.payment_status);
            return (
              <tr key={r.id}>
                <td style={listTableStyles.td}>{r.expense_date?.slice(0, 10)}</td>
                <td style={listTableStyles.td}>{r.category}</td>
                <td style={{ ...listTableStyles.td, fontWeight: 700 }}>{r.description}</td>
                <td style={{ ...listTableStyles.td, textAlign: "right", fontWeight: 800 }}>
                  {rupiah(Number(r.amount))}
                </td>
                <td style={listTableStyles.td}>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 800,
                      background: badge.bg,
                      border: `1px solid ${badge.border}`,
                      color: badge.color,
                    }}
                  >
                    {badge.label}
                  </span>
                </td>
                <td style={listTableStyles.td}>{labelExpensePaymentMethod(r.payment_method)}</td>
                <td style={listTableStyles.td}>{r.recurring_template_id ? "Berulang" : "Manual"}</td>
                <td style={listTableStyles.td}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {r.payment_status === "unpaid" ? (
                      <button type="button" onClick={() => markPaid(r.id)} style={tableActionPrimary()}>
                        Lunas
                      </button>
                    ) : null}
                    <button type="button" onClick={() => openEdit(r)} style={tableActionSecondary()}>
                      Ubah
                    </button>
                    <button type="button" onClick={() => remove(r.id)} style={tableActionDanger()}>
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
  );

  return (
    <>
      <ListPageLayout
        title="Pengeluaran"
        subtitle="Catat biaya operasional harian — praktis untuk UMKM"
        secondaryLink={{ href: "/expenses/summary", label: "Ringkasan Bulanan" }}
        filters={filters}
        totalRows={totalRows}
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        fromIdx={fromIdx}
        toIdx={fromIdx + pageSize - 1}
        clientPagination={clientPagination}
        tableContent={tableContent}
        listCardTitle="Daftar Pengeluaran"
        onPageSizeChange={(v) => {
          setPageSize(v);
          setPage(1);
        }}
      />

      {msg ? (
        <div style={{ marginTop: 12, padding: "0 24px" }}>
          <div style={alert()}>{msg}</div>
        </div>
      ) : null}

      {sheetOpen ? (
        <div style={backdrop()}>
          <div style={sheet()}>
            <h3 style={{ margin: 0 }}>{mode === "create" ? "Catat Pengeluaran" : "Edit Pengeluaran"}</h3>
            <p style={{ marginTop: 6, color: "#666", fontSize: 13 }}>
              Default manual: <b>sudah lunas</b>. Ubah jika belum dibayar.
            </p>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <label style={label()}>
                Tanggal
                <input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                  style={input()}
                />
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
                Deskripsi
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={input()}
                  placeholder="Contoh: Bayar ongkir kirim barang"
                />
              </label>
              <label style={label()}>
                Nominal (Rp)
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Contoh: 1.000.000"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: formatRibuanInput(e.target.value) })}
                  style={input()}
                />
              </label>
              <label style={label()}>
                Status pembayaran
                <select
                  value={form.payment_status}
                  onChange={(e) =>
                    setForm({ ...form, payment_status: e.target.value as "paid" | "unpaid" })
                  }
                  style={input()}
                >
                  <option value="paid">{labelPaymentStatus("paid")}</option>
                  <option value="unpaid">{labelPaymentStatus("unpaid")}</option>
                </select>
              </label>
              <label style={label()}>
                Metode pembayaran (opsional)
                <select
                  value={form.payment_method}
                  onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                  style={input()}
                >
                  <option value="">— Tidak dipilih —</option>
                  {EXPENSE_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  {isLegacyExpensePaymentMethodFormValue(form.payment_method) ? (
                    <option value={form.payment_method}>
                      {legacyExpensePaymentMethodLabel(form.payment_method)} (data lama)
                    </option>
                  ) : null}
                </select>
              </label>
              <label style={label()}>
                Catatan (opsional)
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  style={{ ...input(), minHeight: 72 }}
                />
              </label>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setSheetOpen(false)} style={tableActionSecondary()}>
                  Batal
                </button>
                <button type="button" onClick={save} disabled={saving} style={formPrimaryButton()}>
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function filterInput(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    fontWeight: 600,
    background: "#fff",
  };
}

function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 13, color: "#444", fontWeight: 600 };
}

function input(): React.CSSProperties {
  return { padding: 10, borderRadius: 8, border: "1px solid #ddd", width: "100%", boxSizing: "border-box" };
}

function alert(): React.CSSProperties {
  return {
    border: "1px solid #ffd6d6",
    background: "#fff5f5",
    color: "#8a1f1f",
    borderRadius: 12,
    padding: 12,
    fontWeight: 700,
  };
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
    maxHeight: "90vh",
    overflowY: "auto",
  };
}
