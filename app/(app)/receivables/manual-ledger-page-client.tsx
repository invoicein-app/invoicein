"use client";

import { useEffect, useMemo, useState } from "react";
import ListFiltersClient from "../components/list-filters-client";
import ListPageLayout from "../components/list-page-layout";
import { formatTanggalIndo, ul } from "../components/unified-list-table";
import TableEmptyState from "../components/table-empty-state";
import { formPrimaryButton, tableActionDanger, tableActionSecondary } from "../components/app-action-buttons";
import { formatRibuanInput, parseRibuanInput, rupiah } from "@/lib/money";

type EntryType = "receivable" | "payable";
type PartySourceType = "customer" | "vendor" | "other";

type Party = { id: string; name: string };

type Row = {
  id: string;
  entry_type: EntryType;
  entry_date: string;
  party_source_type: PartySourceType;
  customer_id: string | null;
  vendor_id: string | null;
  party_name: string;
  description: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string | null;
  notes: string | null;
  ledger_status: "BELUM_DIBAYAR" | "SEBAGIAN" | "LUNAS" | "LEWAT_JATUH_TEMPO";
  ledger_status_label: string;
};

type FormState = {
  entry_date: string;
  party_source_type: PartySourceType;
  customer_id: string;
  vendor_id: string;
  party_name: string;
  description: string;
  total_amount: string;
  paid_amount: string;
  due_date: string;
  notes: string;
};

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyForm(): FormState {
  return {
    entry_date: todayIso(),
    party_source_type: "other",
    customer_id: "",
    vendor_id: "",
    party_name: "",
    description: "",
    total_amount: "",
    paid_amount: "",
    due_date: "",
    notes: "",
  };
}

function fmtDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ManualLedgerPageClient({
  entryType,
  pageTitle,
  pageSubtitle,
  cardTitle,
  addLabel,
}: {
  entryType: EntryType;
  pageTitle: string;
  pageSubtitle: string;
  cardTitle: string;
  addLabel: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [vendors, setVendors] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  async function loadParties() {
    const res = await fetch("/api/receivables/parties", { credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return;
    setCustomers(json.customers || []);
    setVendors(json.vendors || []);
  }

  async function loadRows() {
    setLoading(true);
    setMsg("");
    try {
      const params = new URLSearchParams({ type: entryType });
      if (q.trim()) params.set("q", q.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (overdueOnly) params.set("overdue", "1");
      if (month) params.set("month", month);
      const res = await fetch(`/api/manual-ledger-entries?${params.toString()}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.error || "Gagal memuat data.");
        setRows([]);
        return;
      }
      setRows(json.rows || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadParties();
  }, []);

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryType, statusFilter, overdueOnly, month]);

  useEffect(() => {
    const t = setTimeout(() => loadRows(), q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const fromIdx = (page - 1) * pageSize;
  const paginated = useMemo(() => rows.slice(fromIdx, fromIdx + pageSize), [rows, fromIdx, pageSize]);

  function openCreate() {
    setMode("create");
    setEditingId("");
    setForm(emptyForm());
    setSheetOpen(true);
  }

  function openEdit(r: Row) {
    setMode("edit");
    setEditingId(r.id);
    setForm({
      entry_date: r.entry_date || todayIso(),
      party_source_type: r.party_source_type,
      customer_id: r.customer_id || "",
      vendor_id: r.vendor_id || "",
      party_name: r.party_name || "",
      description: r.description || "",
      total_amount: formatRibuanInput(r.total_amount),
      paid_amount: formatRibuanInput(r.paid_amount),
      due_date: r.due_date || "",
      notes: r.notes || "",
    });
    setSheetOpen(true);
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const payload = {
        entry_type: entryType,
        entry_date: form.entry_date,
        party_source_type: form.party_source_type,
        customer_id: form.party_source_type === "customer" ? form.customer_id : null,
        vendor_id: form.party_source_type === "vendor" ? form.vendor_id : null,
        party_name: form.party_source_type === "other" ? form.party_name.trim() : "",
        description: form.description.trim(),
        total_amount: parseRibuanInput(form.total_amount),
        paid_amount: parseRibuanInput(form.paid_amount),
        due_date: form.due_date || null,
        notes: form.notes.trim() || null,
      };
      const url = mode === "create" ? "/api/manual-ledger-entries" : `/api/manual-ledger-entries/${editingId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.error || "Gagal menyimpan.");
        return;
      }
      setSheetOpen(false);
      await loadRows();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Hapus data ini?")) return;
    const res = await fetch(`/api/manual-ledger-entries/${id}`, { method: "DELETE", credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(json?.error || "Gagal hapus.");
    await loadRows();
  }

  const filters = (
    <ListFiltersClient
      searchPlaceholder="Cari pihak / deskripsi / catatan..."
      searchValue={q}
      onSearchChange={(v) => {
        setQ(v);
        setPage(1);
      }}
      onReset={() => {
        setQ("");
        setStatusFilter("");
        setOverdueOnly(false);
        setMonth("");
        setPage(1);
      }}
      perPage={pageSize}
      onPerPageChange={(n) => {
        setPageSize(n);
        setPage(1);
      }}
      perPageOptions={[10, 20, 30, 50]}
      hidePerPage
    >
      <select
        value={statusFilter}
        onChange={(e) => {
          setStatusFilter(e.target.value);
          setPage(1);
        }}
        style={filterInput()}
      >
        <option value="">Aktif (belum lunas)</option>
        <option value="all">Semua status</option>
        <option value="belum_dibayar">Belum Dibayar</option>
        <option value="sebagian">Sebagian</option>
        <option value="lunas">Lunas</option>
        <option value="lewat_jatuh_tempo">Lewat Jatuh Tempo</option>
      </select>
      <input
        type="month"
        value={month}
        onChange={(e) => {
          setMonth(e.target.value);
          setPage(1);
        }}
        style={filterInput()}
      />
      <label style={{ ...filterInput(), display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <input
          type="checkbox"
          checked={overdueOnly}
          onChange={(e) => {
            setOverdueOnly(e.target.checked);
            setPage(1);
          }}
        />
        Overdue saja
      </label>
      <button type="button" onClick={openCreate} style={formPrimaryButton()}>
        {addLabel}
      </button>
    </ListFiltersClient>
  );

  const tableContent = (
    <div className={ul.scroll}>
      <table className={`${ul.table} app-table--receivables-ledger`} style={{ minWidth: 880 }}>
        <thead>
          <tr>
            <th className={ul.th}>Pihak / Deskripsi</th>
            <th className={ul.thCenter}>Status</th>
            <th className={ul.thRight}>Total</th>
            <th className={ul.thRight}>Dibayar</th>
            <th className={ul.thRight}>Sisa</th>
            <th className={ul.th}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={6} className={ul.loading}>
                Memuat…
              </td>
            </tr>
          ) : paginated.length === 0 ? (
            <TableEmptyState colSpan={6} message="Belum ada data." />
          ) : (
            paginated.map((r) => {
              const badge = badgeStyle(r.ledger_status);
              return (
                <tr key={r.id}>
                  <td className={ul.tdTop}>
                    <span className={ul.primaryText}>{r.party_name}</span>
                    <div className={ul.primaryMeta}>
                      {formatTanggalIndo(r.entry_date)} · Jatuh tempo: {formatTanggalIndo(r.due_date)}
                    </div>
                    <div className={ul.primaryMeta}>{labelPartySource(r.party_source_type)}</div>
                    {r.description ? (
                      <div style={{ marginTop: 6, fontSize: 13, color: "#334155" }}>{r.description}</div>
                    ) : null}
                  </td>
                  <td className={ul.tdCenter}>
                    <span
                      className={ul.statusBadge}
                      style={{
                        background: badge.background,
                        color: badge.color,
                        border: badge.border,
                      }}
                    >
                      {r.ledger_status_label}
                    </span>
                  </td>
                  <td className={ul.tdRight}>
                    <span className={ul.money}>{rupiah(r.total_amount)}</span>
                  </td>
                  <td className={ul.tdRight}>
                    <span className={ul.money}>{rupiah(r.paid_amount)}</span>
                  </td>
                  <td className={ul.tdRight}>
                    <span className={ul.money}>{rupiah(r.remaining_amount)}</span>
                  </td>
                  <td className={`${ul.td} app-td-actions`}>
                    <div className={ul.actions}>
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
    </div>
  );

  return (
    <>
      <ListPageLayout
        title={pageTitle}
        subtitle={pageSubtitle}
        filters={
          <>
            {msg ? <div style={alertBox()}>{msg}</div> : null}
            {filters}
          </>
        }
        totalRows={totalRows}
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        fromIdx={fromIdx}
        toIdx={fromIdx + pageSize - 1}
        clientPagination={{
          onFirst: () => setPage(1),
          onPrev: () => setPage((p) => Math.max(1, p - 1)),
          onNext: () => setPage((p) => Math.min(totalPages, p + 1)),
          onLast: () => setPage(totalPages),
        }}
        tableContent={tableContent}
        listCardTitle={cardTitle}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
      />

      {sheetOpen ? (
        <div className="app-modal-backdrop" style={backdrop()}>
          <div className="app-modal-sheet" style={sheet()}>
            <h3 style={{ margin: 0 }}>{mode === "create" ? addLabel : "Ubah Data"}</h3>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <label style={label()}>
                Tanggal
                <input
                  type="date"
                  value={form.entry_date}
                  onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                  style={input()}
                />
              </label>

              <label style={label()}>
                Sumber pihak
                <select
                  value={form.party_source_type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      party_source_type: e.target.value as PartySourceType,
                      customer_id: "",
                      vendor_id: "",
                    })
                  }
                  style={input()}
                >
                  <option value="other">Lainnya (manual)</option>
                  <option value="customer">Customer</option>
                  <option value="vendor">Vendor</option>
                </select>
              </label>

              {form.party_source_type === "customer" ? (
                <label style={label()}>
                  Pilih customer
                  <select
                    value={form.customer_id}
                    onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                    style={input()}
                  >
                    <option value="">— Pilih customer —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {form.party_source_type === "vendor" ? (
                <label style={label()}>
                  Pilih vendor
                  <select
                    value={form.vendor_id}
                    onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                    style={input()}
                  >
                    <option value="">— Pilih vendor —</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {form.party_source_type === "other" ? (
                <label style={label()}>
                  Nama pihak
                  <input
                    value={form.party_name}
                    onChange={(e) => setForm({ ...form, party_name: e.target.value })}
                    style={input()}
                    placeholder="Contoh: Pak Darto / Tukang Las"
                  />
                </label>
              ) : null}

              <label style={label()}>
                Deskripsi
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={input()}
                />
              </label>

              <label style={label()}>
                Nominal total
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.total_amount}
                  onChange={(e) => setForm({ ...form, total_amount: formatRibuanInput(e.target.value) })}
                  style={input()}
                  placeholder="Contoh: 1.000.000"
                />
              </label>

              <label style={label()}>
                Jumlah dibayar
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.paid_amount}
                  onChange={(e) => setForm({ ...form, paid_amount: formatRibuanInput(e.target.value) })}
                  style={input()}
                  placeholder="Contoh: 250.000"
                />
              </label>

              <label style={label()}>
                Jatuh tempo (opsional)
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  style={input()}
                />
              </label>

              <label style={label()}>
                Catatan (opsional)
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  style={{ ...input(), minHeight: 72 }}
                />
              </label>

              <div className="app-modal-sheet__actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
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

function labelPartySource(v: PartySourceType) {
  if (v === "customer") return "Customer";
  if (v === "vendor") return "Vendor";
  return "Manual";
}

function filterInput(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#334155",
    fontSize: 14,
    minWidth: 180,
  };
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
    width: "min(520px, 100%)",
    background: "white",
    borderRadius: 14,
    border: "1px solid #eee",
    padding: 16,
    maxHeight: "90vh",
    overflowY: "auto",
  };
}

function alertBox(): React.CSSProperties {
  return {
    marginBottom: 10,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#991b1b",
    fontSize: 13,
    fontWeight: 600,
  };
}

function badgeStyle(status: Row["ledger_status"]): React.CSSProperties {
  if (status === "LUNAS") return { ...badgeBase(), background: "#ecfdf5", color: "#065f46", borderColor: "#86efac" };
  if (status === "SEBAGIAN") return { ...badgeBase(), background: "#fff7ed", color: "#9a3412", borderColor: "#fdba74" };
  if (status === "LEWAT_JATUH_TEMPO") return { ...badgeBase(), background: "#fee2e2", color: "#991b1b", borderColor: "#fca5a5" };
  return { ...badgeBase(), background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" };
}

function badgeBase(): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid",
    whiteSpace: "nowrap",
    display: "inline-block",
  };
}
