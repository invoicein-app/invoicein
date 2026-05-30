"use client";

import { useEffect, useState } from "react";
import { rupiah } from "@/lib/money";
import { monthKeyFromDate, monthStart } from "@/lib/invoice-totals";
import {
  expenseAlertBox,
  expenseContentCard,
  expenseKpiGrid,
  expenseMonthInput,
} from "../expense-page-styles";
import ExpenseSubPageShell from "../expense-subpage-shell";

type Summary = {
  month: string;
  monthlySalesTotal: number;
  salesSource: string;
  totalExpenses: number;
  paidExpenses: number;
  unpaidExpenses: number;
  profitEstimate: number;
  byCategory: { category: string; total: number }[];
};

const defaultMonth = monthKeyFromDate(monthStart(new Date()));

export default function ExpensesSummaryPage() {
  const [month, setMonth] = useState(defaultMonth);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function load(m: string) {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/expenses/summary?month=${m}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.error || "Gagal memuat ringkasan.");
        setData(null);
        return;
      }
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(month);
  }, [month]);

  return (
    <ExpenseSubPageShell
      title="Ringkasan Bulanan"
      subtitle="Perkiraan laba sederhana: omset invoice lunas − pengeluaran yang sudah lunas."
      actions={
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={expenseMonthInput}
          aria-label="Pilih bulan"
        />
      }
      plain
    >
      {msg ? <div style={expenseAlertBox()}>{msg}</div> : null}

      {loading ? (
        <p style={{ color: "#64748b", margin: 0, lineHeight: 1.5 }}>Memuat...</p>
      ) : data ? (
        <>
          <div className="app-expense-kpi-grid" style={expenseKpiGrid}>
            <div style={kpiCard("#ecfdf5")}>
              <div style={kpiLabel()}>Omset (Invoice Lunas)</div>
              <div className="app-expense-kpi-value" style={kpiValue()}>
                {rupiah(data.monthlySalesTotal)}
              </div>
              <div style={kpiHint()}>Berdasarkan tanggal invoice, status PAID</div>
            </div>
            <div style={kpiCard("#f8fafc")}>
              <div style={kpiLabel()}>Total Pengeluaran</div>
              <div className="app-expense-kpi-value" style={kpiValue()}>
                {rupiah(data.totalExpenses)}
              </div>
              <div style={kpiHint()}>Semua pengeluaran bulan {data.month}</div>
            </div>
            <div style={kpiCard("#eff6ff")}>
              <div style={kpiLabel()}>Sudah Lunas</div>
              <div className="app-expense-kpi-value" style={kpiValue()}>
                {rupiah(data.paidExpenses)}
              </div>
            </div>
            <div style={kpiCard("#fff7ed")}>
              <div style={kpiLabel()}>Belum Lunas</div>
              <div className="app-expense-kpi-value" style={kpiValue()}>
                {rupiah(data.unpaidExpenses)}
              </div>
            </div>
          </div>

          <div
            style={{
              ...kpiCard(data.profitEstimate >= 0 ? "#f0fdf4" : "#fef2f2"),
              padding: 20,
            }}
          >
            <div style={kpiLabel()}>Perkiraan Laba Bulanan</div>
            <div className="app-expense-profit-value" style={{ ...kpiValue(), fontSize: 28 }}>
              {rupiah(data.profitEstimate)}
            </div>
            <div style={kpiHint()}>
              Omset lunas ({rupiah(data.monthlySalesTotal)}) − pengeluaran lunas ({rupiah(data.paidExpenses)})
            </div>
          </div>

          {data.byCategory.length > 0 ? (
            <div style={expenseContentCard}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#333", marginBottom: 16 }}>
                Pengeluaran per Kategori
              </div>
              <div className="app-table-scroll">
                <table className="app-data-table app-table--expenses-summary">
                  <thead>
                    <tr>
                      <th>Kategori</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byCategory.map((row) => (
                      <tr key={row.category}>
                        <td data-label="Kategori">{row.category}</td>
                        <td data-label="Total">{rupiah(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </ExpenseSubPageShell>
  );
}

function kpiCard(bg: string): React.CSSProperties {
  return {
    background: bg,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
  };
}

function kpiLabel(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 };
}

function kpiValue(): React.CSSProperties {
  return { fontSize: 22, fontWeight: 800, color: "#111827" };
}

function kpiHint(): React.CSSProperties {
  return { marginTop: 8, fontSize: 12, color: "#64748b", lineHeight: 1.4 };
}

