"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ListFiltersClient from "../components/list-filters-client";
import ListPageLayout from "../components/list-page-layout";
import { formatTanggalIndo, ul } from "../components/unified-list-table";
import { formPrimaryButton, tableActionPrimary } from "../components/app-action-buttons";
import { rupiah } from "@/lib/money";
import TableEmptyState from "../components/table-empty-state";

type SummaryRow = {
  customer_id: string | null;
  customer_name: string;
  total_receivable: number;
  invoice_count: number;
  overdue_count: number;
  nearest_due_date: string | null;
  progress_percent: number;
};

function fmtDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ReceivablesPage() {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [overdueFilter, setOverdueFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (overdueFilter) params.set("overdue", overdueFilter);
      const res = await fetch(`/api/receivables/summary?${params.toString()}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.error || "Gagal memuat data piutang.");
        setRows([]);
        return;
      }
      setRows(json.rows || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overdueFilter]);

  useEffect(() => {
    const t = setTimeout(() => load(), q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const fromIdx = (page - 1) * pageSize;
  const paginated = useMemo(() => rows.slice(fromIdx, fromIdx + pageSize), [rows, fromIdx, pageSize]);

  const totalReceivable = useMemo(() => rows.reduce((a, r) => a + r.total_receivable, 0), [rows]);
  const totalInvoices = useMemo(() => rows.reduce((a, r) => a + r.invoice_count, 0), [rows]);
  const totalOverdue = useMemo(() => rows.reduce((a, r) => a + r.overdue_count, 0), [rows]);

  const filters = (
    <ListFiltersClient
      searchPlaceholder="Cari customer..."
      searchValue={q}
      onSearchChange={(v) => {
        setQ(v);
        setPage(1);
      }}
      onReset={() => {
        setQ("");
        setOverdueFilter("");
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
        value={overdueFilter}
        onChange={(e) => {
          setOverdueFilter(e.target.value);
          setPage(1);
        }}
        style={filterInput()}
      >
        <option value="">Semua piutang</option>
        <option value="overdue">Ada yang overdue</option>
        <option value="non_overdue">Belum overdue</option>
      </select>
      <button type="button" onClick={() => load()} style={formPrimaryButton()}>
        Refresh
      </button>
    </ListFiltersClient>
  );

  const tableContent = (
    <div className={ul.scroll}>
      <table className={`${ul.table} app-table--receivables-summary`} style={{ minWidth: 800 }}>
        <thead>
          <tr>
            <th className={ul.th}>Customer</th>
            <th className={ul.thRight}>Total Piutang</th>
            <th className={ul.thRight}>Jumlah Invoice</th>
            <th className={ul.thRight}>Overdue</th>
            <th className={ul.th}>Jatuh Tempo Terdekat</th>
            <th className={ul.th}>Progress</th>
            <th className={ul.th}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={7} className={ul.loading}>
                Memuat…
              </td>
            </tr>
          ) : paginated.length === 0 ? (
            <TableEmptyState colSpan={7} message="Belum ada customer." />
          ) : (
            paginated.map((r) => (
              <tr key={`${r.customer_id || "name"}-${r.customer_name}`}>
                <td className={ul.tdTop}>
                  <span className={ul.primaryText}>{r.customer_name}</span>
                  <div className={ul.primaryMeta}>
                    {r.invoice_count} invoice{r.invoice_count !== 1 ? "" : ""}
                    {r.overdue_count > 0 ? ` · ${r.overdue_count} overdue` : ""}
                  </div>
                </td>
                <td className={ul.tdRight}>
                  <span className={ul.money}>{rupiah(r.total_receivable)}</span>
                </td>
                <td className={ul.tdRight}>{r.invoice_count}</td>
                <td className={ul.tdRight}>{r.overdue_count}</td>
                <td className={ul.td}>{formatTanggalIndo(r.nearest_due_date)}</td>
                <td className={ul.td}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={progressBarWrap()}>
                      <div style={progressBarFill(r.progress_percent)} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 12 }}>{r.progress_percent}%</span>
                  </div>
                </td>
                <td className={`${ul.td} app-td-actions`}>
                  <Link
                    href={`/receivables/customer?${new URLSearchParams({
                      ...(r.customer_id ? { customer_id: r.customer_id } : { customer_name: r.customer_name }),
                    }).toString()}`}
                    style={tableActionPrimary()}
                  >
                    Lihat Detail
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <ListPageLayout
      title="Piutang"
      subtitle="Pantau piutang customer berdasarkan data invoice & pembayaran yang sudah ada."
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
          <div className="app-summary-pills" style={{ marginBottom: 10, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12 }}>
            <span style={kpiPill()}>{`Total Piutang: ${rupiah(totalReceivable)}`}</span>
            <span style={kpiPill()}>{`Invoice Aktif: ${totalInvoices}`}</span>
            <span style={kpiPill()}>{`Invoice Overdue: ${totalOverdue}`}</span>
          </div>
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
      listCardTitle="Piutang Customer"
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

function progressBarWrap(): React.CSSProperties {
  return {
    width: 92,
    height: 8,
    borderRadius: 999,
    background: "#e5e7eb",
    overflow: "hidden",
  };
}

function progressBarFill(percent: number): React.CSSProperties {
  return {
    width: `${Math.max(0, Math.min(100, percent))}%`,
    height: "100%",
    background: "#2D7D71",
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
