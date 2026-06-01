"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import ListFiltersClient from "../../components/list-filters-client";
import ListPageLayout from "../../components/list-page-layout";
import { formatTanggalIndo, ul } from "../../components/unified-list-table";
import TableEmptyState from "../../components/table-empty-state";
import { formPrimaryButton, tableActionSecondary } from "../../components/app-action-buttons";
import { rupiah } from "@/lib/money";

type DetailSummary = {
  customer_id: string | null;
  customer_name: string;
  total_receivable: number;
  invoice_count: number;
  overdue_count: number;
  nearest_due_date: string | null;
};

type InvoiceRow = {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  grand_total: number;
  paid_amount: number;
  remaining_amount: number;
  receivable_status: "BELUM_DIBAYAR" | "SEBAGIAN" | "LUNAS" | "LEWAT_JATUH_TEMPO";
  receivable_status_label: string;
};

function fmtDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function ReceivableCustomerDetailInner() {
  const sp = useSearchParams();
  const customerId = sp.get("customer_id") || "";
  const customerNameParam = sp.get("customer_name") || "";

  const [summary, setSummary] = useState<DetailSummary | null>(null);
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState("");
  const [dueMonth, setDueMonth] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  async function load() {
    if (!customerId && !customerNameParam) return;
    setLoading(true);
    setMsg("");
    try {
      const params = new URLSearchParams();
      if (customerId) params.set("customer_id", customerId);
      if (!customerId && customerNameParam) params.set("customer_name", customerNameParam);
      if (q.trim()) params.set("q", q.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (overdueOnly) params.set("overdue", "1");
      if (dueMonth) params.set("due_month", dueMonth);

      const res = await fetch(`/api/receivables/customer-invoices?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.error || "Gagal memuat detail piutang customer.");
        setRows([]);
        setSummary(null);
        return;
      }
      setSummary(json.summary || null);
      setRows(json.invoices || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, customerNameParam, statusFilter, overdueOnly, dueMonth]);

  useEffect(() => {
    const t = setTimeout(() => load(), q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const fromIdx = (page - 1) * pageSize;
  const paginated = useMemo(() => rows.slice(fromIdx, fromIdx + pageSize), [rows, fromIdx, pageSize]);

  const filters = (
    <ListFiltersClient
      searchPlaceholder="Cari nomor invoice..."
      searchValue={q}
      onSearchChange={(v) => {
        setQ(v);
        setPage(1);
      }}
      onReset={() => {
        setQ("");
        setStatusFilter("");
        setOverdueOnly("");
        setDueMonth("");
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
        <option value="belum_dibayar">Belum dibayar</option>
        <option value="sebagian">Sebagian</option>
        <option value="lunas">Lunas</option>
        <option value="lewat_jatuh_tempo">Lewat jatuh tempo</option>
      </select>
      <input
        type="month"
        value={dueMonth}
        onChange={(e) => {
          setDueMonth(e.target.value);
          setPage(1);
        }}
        style={filterInput()}
        aria-label="Filter bulan jatuh tempo"
      />
      <label style={{ ...filterInput(), display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <input
          type="checkbox"
          checked={overdueOnly === "1"}
          onChange={(e) => {
            setOverdueOnly(e.target.checked ? "1" : "");
            setPage(1);
          }}
        />
        Overdue saja
      </label>
      <button type="button" onClick={() => load()} style={formPrimaryButton()}>
        Refresh
      </button>
      <Link href="/receivables" style={tableActionSecondary()}>
        Kembali
      </Link>
    </ListFiltersClient>
  );

  const tableContent = (
    <div className={ul.scroll}>
      <table className={`${ul.table} app-table--receivables-detail`} style={{ minWidth: 760 }}>
        <thead>
          <tr>
            <th className={ul.th}>Nomor Invoice</th>
            <th className={ul.thCenter}>Status</th>
            <th className={ul.thRight}>Total</th>
            <th className={ul.thRight}>Terbayar</th>
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
            <TableEmptyState colSpan={6} message="Belum ada invoice." />
          ) : (
            paginated.map((r) => {
              const badge = badgeStyle(r.receivable_status);
              return (
                <tr key={r.id}>
                  <td className={ul.tdTop}>
                    <Link href={`/invoice/${r.id}`} className={ul.primaryLink}>
                      {r.invoice_number || "(Tanpa nomor)"}
                    </Link>
                    <div className={ul.primaryMeta}>
                      Tanggal: {formatTanggalIndo(r.invoice_date)} · Jatuh tempo: {formatTanggalIndo(r.due_date)}
                    </div>
                  </td>
                  <td className={ul.tdCenter}>
                    <span className={ul.statusBadge} style={badge}>
                      {r.receivable_status_label}
                    </span>
                  </td>
                  <td className={ul.tdRight}>
                    <span className={ul.money}>{rupiah(r.grand_total)}</span>
                  </td>
                  <td className={ul.tdRight}>
                    <span className={ul.money}>{rupiah(r.paid_amount)}</span>
                  </td>
                  <td className={ul.tdRight}>
                    <span className={ul.money}>{rupiah(r.remaining_amount)}</span>
                  </td>
                  <td className={`${ul.td} app-td-actions`}>
                    <Link href={`/invoice/${r.id}`} style={tableActionSecondary()}>
                      Buka Invoice
                    </Link>
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
    <ListPageLayout
      title="Detail Piutang Customer"
      subtitle={summary ? `${summary.customer_name} • Invoice aktif: ${summary.invoice_count}` : "Rincian invoice per customer"}
      filters={
        <>
          {msg ? (
            <div
              style={{
                marginBottom: 10,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #fecaca",
                background: "#fff1f2",
                color: "#991b1b",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {msg}
            </div>
          ) : null}
          {summary ? (
            <div className="app-summary-pills" style={{ marginBottom: 10, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12 }}>
              <span style={kpiPill()}>{`Total Piutang: ${rupiah(summary.total_receivable)}`}</span>
              <span style={kpiPill()}>{`Invoice Aktif: ${summary.invoice_count}`}</span>
              <span style={kpiPill()}>{`Overdue: ${summary.overdue_count}`}</span>
              <span style={kpiPill()}>{`Jatuh Tempo Terdekat: ${fmtDate(summary.nearest_due_date)}`}</span>
            </div>
          ) : null}
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
      listCardTitle="Invoice Piutang"
      onPageSizeChange={(n) => {
        setPageSize(n);
        setPage(1);
      }}
    />
  );
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

function kpiPill(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#334155",
    fontWeight: 700,
  };
}

function badgeStyle(status: InvoiceRow["receivable_status"]): React.CSSProperties {
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

export default function ReceivableCustomerDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: "#64748b" }}>Memuat...</div>}>
      <ReceivableCustomerDetailInner />
    </Suspense>
  );
}
