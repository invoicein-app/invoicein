"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ListFiltersClient from "../components/list-filters-client";
import ListPageLayout from "../components/list-page-layout";
import { formatTanggalIndo, ul } from "../components/unified-list-table";
import { formPrimaryButton, tableActionPrimary } from "../components/app-action-buttons";
import { rupiah } from "@/lib/money";
import TableEmptyState from "../components/table-empty-state";

type AgingAmounts = {
  current: number;
  days_0_30: number;
  days_31_60: number;
  days_60_plus: number;
};

type SummaryRow = {
  customer_id: string | null;
  customer_name: string;
  total_receivable: number;
  invoice_count: number;
  overdue_count: number;
  nearest_due_date: string | null;
  progress_percent: number;
  aging: AgingAmounts;
};

const emptyAging = (): AgingAmounts => ({
  current: 0,
  days_0_30: 0,
  days_31_60: 0,
  days_60_plus: 0,
});

function fmtDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ReceivablesPage() {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [agingTotals, setAgingTotals] = useState<AgingAmounts>(emptyAging());
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [overdueFilter, setOverdueFilter] = useState("");
  const [agingFilter, setAgingFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (overdueFilter) params.set("overdue", overdueFilter);
      if (agingFilter) params.set("aging", agingFilter);
      const res = await fetch(`/api/receivables/summary?${params.toString()}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.error || "Gagal memuat data piutang.");
        setRows([]);
        setAgingTotals(emptyAging());
        return;
      }
      setRows(json.rows || []);
      setAgingTotals(json.aging_totals || emptyAging());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overdueFilter, agingFilter]);

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
        setAgingFilter("");
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
      <select
        value={agingFilter}
        onChange={(e) => {
          setAgingFilter(e.target.value);
          setPage(1);
        }}
        style={filterInput()}
        aria-label="Filter umur piutang"
      >
        <option value="">Semua umur</option>
        <option value="current">Belum jatuh tempo</option>
        <option value="0_30">0–30 hari lewat JT</option>
        <option value="31_60">31–60 hari lewat JT</option>
        <option value="60_plus">60+ hari lewat JT</option>
      </select>
      <button type="button" onClick={() => load()} style={formPrimaryButton()}>
        Refresh
      </button>
    </ListFiltersClient>
  );

  const tableContent = (
    <div className={ul.scroll}>
      <table className={`${ul.table} app-table--receivables-summary`} style={{ minWidth: 1080 }}>
        <thead>
          <tr>
            <th className={ul.th}>Customer</th>
            <th className={ul.thRight}>Total</th>
            <th className={ul.thRight}>Belum JT</th>
            <th className={ul.thRight}>0–30 hr</th>
            <th className={ul.thRight}>31–60 hr</th>
            <th className={ul.thRight}>60+ hr</th>
            <th className={ul.thRight}>Inv</th>
            <th className={ul.th}>JT Terdekat</th>
            <th className={ul.th}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={9} className={ul.loading}>
                Memuat…
              </td>
            </tr>
          ) : paginated.length === 0 ? (
            <TableEmptyState colSpan={9} message="Belum ada customer." />
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
                <td className={ul.tdRight}>{agingCell(r.aging?.current)}</td>
                <td className={ul.tdRight}>{agingCell(r.aging?.days_0_30, true)}</td>
                <td className={ul.tdRight}>{agingCell(r.aging?.days_31_60, true)}</td>
                <td className={ul.tdRight}>{agingCell(r.aging?.days_60_plus, true)}</td>
                <td className={ul.tdRight}>{r.invoice_count}</td>
                <td className={ul.td}>{formatTanggalIndo(r.nearest_due_date)}</td>
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
      subtitle="Pantau piutang customer dengan aging 0–30 / 31–60 / 60+ hari lewat jatuh tempo."
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
            <span style={kpiPill()}>{`Overdue: ${totalOverdue}`}</span>
            <span style={kpiPill()}>{`Belum JT: ${rupiah(agingTotals.current)}`}</span>
            <span style={kpiPill({ warn: true })}>{`0–30 hr: ${rupiah(agingTotals.days_0_30)}`}</span>
            <span style={kpiPill({ warn: true })}>{`31–60 hr: ${rupiah(agingTotals.days_31_60)}`}</span>
            <span style={kpiPill({ danger: true })}>{`60+ hr: ${rupiah(agingTotals.days_60_plus)}`}</span>
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

function agingCell(amount?: number, highlightOverdue = false) {
  const n = Number(amount || 0);
  if (n <= 0) return <span style={{ color: "#94a3b8" }}>—</span>;
  return (
    <span
      className={ul.money}
      style={highlightOverdue ? { color: "#b91c1c", fontWeight: 700 } : undefined}
    >
      {rupiah(n)}
    </span>
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

function kpiPill(opts?: { warn?: boolean; danger?: boolean }): React.CSSProperties {
  if (opts?.danger) {
    return {
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid #fca5a5",
      background: "#fef2f2",
      color: "#991b1b",
      fontWeight: 700,
    };
  }
  if (opts?.warn) {
    return {
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid #fdba74",
      background: "#fff7ed",
      color: "#9a3412",
      fontWeight: 700,
    };
  }
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#334155",
    fontWeight: 700,
  };
}
