"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ListFiltersClient from "../../components/list-filters-client";
import ListPageLayout, { listTableStyles } from "../../components/list-page-layout";
import { rupiah } from "@/lib/money";
import { ID_MONTHS } from "@/lib/customer-item-summary";

type SummaryRow = {
  customer_id: string;
  customer_name: string;
  product_id: string | null;
  item_key: string | null;
  product_name: string;
  latest_price: number;
  total_qty: number;
  transaction_count: number;
  last_updated: string | null;
  lifetime_latest_price: number | null;
  lifetime_updated_at: string | null;
};

type PeriodInfo = {
  month: number;
  year: number;
  start: string;
  end: string;
  label: string;
};

const now = new Date();

function fmtDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

const filterSelectStyle: React.CSSProperties = {
  height: 44,
  minWidth: 140,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  outline: "none",
  fontSize: 14,
  fontWeight: 700,
  color: "#334155",
  background: "#fff",
  cursor: "pointer",
  boxSizing: "border-box",
};

export default function CustomerPricelistPage() {
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [yearOptions, setYearOptions] = useState<number[]>([now.getFullYear()]);
  const [period, setPeriod] = useState<PeriodInfo | null>(null);
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [qCustomer, setQCustomer] = useState("");
  const [qProduct, setQProduct] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
      });
      if (qCustomer.trim()) params.set("q_customer", qCustomer.trim());
      if (qProduct.trim()) params.set("q_product", qProduct.trim());

      const res = await fetch(`/api/customer-item-latest-prices/summary?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.error || "Gagal memuat daftar harga customer.");
        setRows([]);
        setPeriod(null);
        return;
      }
      setRows(json.rows || []);
      setPeriod(json.period || null);
      if (Array.isArray(json.year_options) && json.year_options.length > 0) {
        setYearOptions(json.year_options);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  useEffect(() => {
    const t = setTimeout(() => load(), qCustomer || qProduct ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qCustomer, qProduct]);

  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const fromIdx = (page - 1) * pageSize;
  const toIdx = Math.min(fromIdx + pageSize, totalRows);
  const paginated = useMemo(() => rows.slice(fromIdx, fromIdx + pageSize), [rows, fromIdx, pageSize]);

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
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600, color: "#64748b" }}>
          Bulan
          <select
            value={month}
            onChange={(e) => {
              setMonth(Number(e.target.value));
              setPage(1);
            }}
            style={filterSelectStyle}
            aria-label="Pilih bulan"
          >
            {ID_MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600, color: "#64748b" }}>
          Tahun
          <select
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value));
              setPage(1);
            }}
            style={filterSelectStyle}
            aria-label="Pilih tahun"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        {period ? (
          <div
            style={{
              marginLeft: "auto",
              padding: "10px 14px",
              borderRadius: 10,
              background: "#ecfdf5",
              color: "#065f46",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Periode: {period.label}
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <ListFiltersClient
          searchPlaceholder="Cari customer..."
          searchValue={qCustomer}
          onSearchChange={(v) => {
            setQCustomer(v);
            setPage(1);
          }}
          hidePerPage
        />
        <ListFiltersClient
          searchPlaceholder="Cari barang..."
          searchValue={qProduct}
          onSearchChange={(v) => {
            setQProduct(v);
            setPage(1);
          }}
          onReset={() => {
            setQCustomer("");
            setQProduct("");
            setMonth(now.getMonth() + 1);
            setYear(now.getFullYear());
            setPage(1);
          }}
          hidePerPage
        />
      </div>
    </div>
  );

  const tableContent = loading ? (
    <p style={{ color: "#64748b", margin: 0 }}>Memuat...</p>
  ) : rows.length === 0 ? (
    <p style={{ color: "#64748b", margin: 0 }}>
      Tidak ada transaksi customer + barang untuk periode {period?.label || "ini"}.
      {qCustomer || qProduct ? " Coba ubah filter pencarian." : ""}
    </p>
  ) : (
    <>
      <div className="app-table-scroll" style={{ overflowX: "auto" }}>
        <table className="app-table" style={listTableStyles.table}>
          <thead>
            <tr>
              <th style={listTableStyles.th}>Customer</th>
              <th style={listTableStyles.th}>Barang / Item</th>
              <th style={{ ...listTableStyles.th, textAlign: "right" }}>Harga terakhir</th>
              <th style={{ ...listTableStyles.th, textAlign: "right" }}>Total qty</th>
              <th style={{ ...listTableStyles.th, textAlign: "right" }}>Jumlah transaksi</th>
              <th style={listTableStyles.th}>Update terakhir</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((r) => (
              <tr key={`${r.customer_id}-${r.product_id || r.item_key}`}>
                <td style={listTableStyles.td}>
                  <Link
                    href={`/receivables/customer?customer_id=${encodeURIComponent(r.customer_id)}&customer_name=${encodeURIComponent(r.customer_name)}`}
                    style={{ color: "#1E7F75", fontWeight: 700, textDecoration: "none" }}
                  >
                    {r.customer_name}
                  </Link>
                </td>
                <td style={listTableStyles.td}>
                  <div style={{ fontWeight: 700 }}>{r.product_name}</div>
                  {r.item_key ? (
                    <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>{r.item_key}</div>
                  ) : null}
                </td>
                <td style={listTableStyles.tdRight}>
                  <div>{rupiah(r.latest_price)}</div>
                  {r.lifetime_latest_price != null &&
                  r.lifetime_latest_price !== r.latest_price &&
                  period &&
                  r.lifetime_updated_at ? (
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                      Harga global: {rupiah(r.lifetime_latest_price)}
                    </div>
                  ) : null}
                </td>
                <td style={listTableStyles.tdRight}>{r.total_qty.toLocaleString("id-ID")}</td>
                <td style={listTableStyles.tdRight}>{r.transaction_count.toLocaleString("id-ID")}</td>
                <td style={listTableStyles.td}>{fmtDate(r.last_updated)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ margin: "12px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
        Harga terakhir = harga pada transaksi invoice terbaru customer + barang dalam periode{" "}
        {period?.label}. Total qty = jumlah qty dari semua baris invoice. Jumlah transaksi = jumlah invoice
        berbeda yang memuat barang tersebut.
      </p>
    </>
  );

  return (
    <>
      {msg ? (
        <div style={{ margin: "0 0 12px", padding: 12, borderRadius: 10, background: "#fef2f2", color: "#991b1b" }}>
          {msg}
        </div>
      ) : null}

      <ListPageLayout
        title="Daftar Harga Customer"
        subtitle="Ringkasan harga terakhir dan volume pembelian per customer per barang, per bulan."
        secondaryLink={{ href: "/customers", label: "← Master Customer" }}
        filters={filters}
        totalRows={totalRows}
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        fromIdx={totalRows === 0 ? 0 : fromIdx + 1}
        toIdx={toIdx}
        clientPagination={clientPagination}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        perPageOptions={[10, 20, 30, 50]}
        tableContent={tableContent}
        listCardTitle={`Ringkasan · ${period?.label || "Periode"}`}
      />
    </>
  );
}
