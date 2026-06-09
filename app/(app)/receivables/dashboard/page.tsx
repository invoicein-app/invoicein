"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { rupiah } from "@/lib/money";
import { APP_TEAL } from "../../components/app-ui-tokens";
import { formatTanggalIndo } from "../../components/unified-list-table";

type AgingAmounts = {
  current: number;
  days_0_30: number;
  days_31_60: number;
  days_60_plus: number;
};

type DashboardData = {
  today: string;
  totals: {
    total_receivable: number;
    customer_count: number;
    invoice_count: number;
    overdue_count: number;
    status_belum_dibayar: number;
    status_sebagian: number;
  };
  aging_totals: AgingAmounts;
  top_customers: Array<{
    customer_id: string | null;
    customer_name: string;
    total_receivable: number;
    invoice_count: number;
    overdue_count: number;
    aging: AgingAmounts;
  }>;
  urgent_invoices: Array<{
    id: string;
    invoice_number: string | null;
    customer_id: string | null;
    customer_name: string;
    due_date: string | null;
    remaining_amount: number;
    aging_bucket_label: string;
    days_past_due: number;
  }>;
};

const AGING_CHART = [
  { key: "current" as const, label: "Belum JT", color: "#2D7D71" },
  { key: "days_0_30" as const, label: "0–30 hr", color: "#f59e0b" },
  { key: "days_31_60" as const, label: "31–60 hr", color: "#ea580c" },
  { key: "days_60_plus" as const, label: "60+ hr", color: "#dc2626" },
];

export default function ReceivablesDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMsg("");
      try {
        const res = await fetch("/api/receivables/dashboard", { credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setMsg(json?.error || "Gagal memuat dashboard piutang.");
          setData(null);
          return;
        }
        setData(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxAging = useMemo(() => {
    if (!data) return 1;
    const a = data.aging_totals;
    return Math.max(1, a.current, a.days_0_30, a.days_31_60, a.days_60_plus);
  }, [data]);

  if (loading) {
    return (
      <div style={pageWrap()}>
        <p style={{ color: "#64748b", margin: 0 }}>Memuat dashboard piutang…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={pageWrap()}>
        <h1 style={titleStyle()}>Dashboard Piutang</h1>
        <p style={{ color: "#b91c1c", fontWeight: 600 }}>{msg || "Data tidak tersedia."}</p>
      </div>
    );
  }

  const { totals, aging_totals, top_customers, urgent_invoices, today } = data;

  return (
    <div style={pageWrap()}>
      <div style={headerRow()}>
        <div>
          <h1 style={titleStyle()}>Dashboard Piutang</h1>
          <p style={subtitleStyle()}>
            Snapshot piutang customer per {formatTanggalIndo(today)} — fokus follow-up tagihan overdue.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/receivables" style={btnOutline()}>
            Daftar Customer
          </Link>
          <Link href="/receivables?aging=60_plus" style={btnSolid()}>
            Tagih 60+ hr
          </Link>
        </div>
      </div>

      <div style={kpiGrid()}>
        <div style={kpiCard("#ecfdf5", "#065f46")}>
          <div style={kpiLabel()}>Total Piutang</div>
          <div style={kpiValue()}>{rupiah(totals.total_receivable)}</div>
          <div style={kpiFoot()}>{totals.invoice_count} invoice aktif</div>
        </div>
        <div style={kpiCard("#f0f9ff", "#0369a1")}>
          <div style={kpiLabel()}>Customer Berpiutang</div>
          <div style={kpiValue()}>{totals.customer_count}</div>
          <div style={kpiFoot()}>Belum lunas</div>
        </div>
        <div style={kpiCard("#fff7ed", "#c2410c")}>
          <div style={kpiLabel()}>Invoice Overdue</div>
          <div style={kpiValue()}>{totals.overdue_count}</div>
          <div style={kpiFoot()}>
            Belum bayar: {totals.status_belum_dibayar} · Sebagian: {totals.status_sebagian}
          </div>
        </div>
        <div style={kpiCard("#fef2f2", "#991b1b")}>
          <div style={kpiLabel()}>60+ Hari Lewat JT</div>
          <div style={kpiValue()}>{rupiah(aging_totals.days_60_plus)}</div>
          <div style={kpiFoot()}>Prioritas follow-up</div>
        </div>
      </div>

      <div style={bottomGrid()}>
        <div style={card()}>
          <h2 style={cardTitle()}>Aging Piutang</h2>
          <p style={cardSub()}>Distribusi sisa tagihan berdasarkan umur lewat jatuh tempo</p>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {AGING_CHART.map((b) => {
              const value = aging_totals[b.key];
              const pct = Math.max(value > 0 ? 6 : 0, Math.round((value / maxAging) * 100));
              return (
                <div
                  key={b.key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "88px 1fr minmax(100px, 120px)",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>{b.label}</div>
                  <div
                    style={{
                      height: 24,
                      background: "#f1f5f9",
                      borderRadius: 6,
                      overflow: "hidden",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: b.color,
                        borderRadius: 5,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", textAlign: "right" }}>
                    {rupiah(value)}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {AGING_CHART.map((b) => (
              <Link
                key={b.key}
                href={`/receivables?aging=${b.key === "current" ? "current" : b.key === "days_0_30" ? "0_30" : b.key === "days_31_60" ? "31_60" : "60_plus"}`}
                style={agingLinkPill(b.color)}
              >
                {b.label}
              </Link>
            ))}
          </div>
        </div>

        <div style={card()}>
          <h2 style={cardTitle()}>Perlu Follow-up</h2>
          <p style={cardSub()}>Invoice lewat jatuh tempo — urut umur tertua</p>
          {urgent_invoices.length === 0 ? (
            <p style={{ color: "#64748b", marginTop: 16 }}>Tidak ada invoice overdue. 👍</p>
          ) : (
            <div style={{ marginTop: 12 }}>
              {urgent_invoices.map((inv) => (
                <Link key={inv.id} href={`/invoice/${inv.id}`} style={urgentRow(inv.days_past_due)}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>
                      {inv.invoice_number || "Invoice"}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                      {inv.customer_name} · JT {formatTanggalIndo(inv.due_date)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{rupiah(inv.remaining_amount)}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: urgentColor(inv.days_past_due), marginTop: 4 }}>
                      {inv.aging_bucket_label} · {inv.days_past_due} hr
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ ...card(), marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={cardTitle()}>Top Customer Piutang</h2>
            <p style={cardSub()}>Customer dengan sisa tagihan terbesar</p>
          </div>
          <Link href="/receivables" style={{ ...btnOutline(), fontSize: 13, padding: "8px 14px" }}>
            Lihat semua →
          </Link>
        </div>
        {top_customers.length === 0 ? (
          <p style={{ color: "#64748b", marginTop: 16 }}>Belum ada piutang aktif.</p>
        ) : (
          <div style={{ marginTop: 14, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640, fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                  <th style={th()}>Customer</th>
                  <th style={{ ...th(), textAlign: "right" }}>Total</th>
                  <th style={{ ...th(), textAlign: "right" }}>60+ hr</th>
                  <th style={{ ...th(), textAlign: "right" }}>Inv</th>
                  <th style={th()}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {top_customers.map((c) => (
                  <tr key={`${c.customer_id || "n"}-${c.customer_name}`} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <td style={td()}>
                      <div style={{ fontWeight: 700 }}>{c.customer_name}</div>
                      {c.overdue_count > 0 ? (
                        <div style={{ fontSize: 12, color: "#b91c1c" }}>{c.overdue_count} overdue</div>
                      ) : null}
                    </td>
                    <td style={{ ...td(), textAlign: "right", fontWeight: 700 }}>{rupiah(c.total_receivable)}</td>
                    <td style={{ ...td(), textAlign: "right", color: c.aging.days_60_plus > 0 ? "#b91c1c" : "#94a3b8", fontWeight: 700 }}>
                      {c.aging.days_60_plus > 0 ? rupiah(c.aging.days_60_plus) : "—"}
                    </td>
                    <td style={{ ...td(), textAlign: "right" }}>{c.invoice_count}</td>
                    <td style={td()}>
                      <Link
                        href={`/receivables/customer?${new URLSearchParams({
                          ...(c.customer_id ? { customer_id: c.customer_id } : { customer_name: c.customer_name }),
                        }).toString()}`}
                        style={{ color: APP_TEAL, fontWeight: 700, textDecoration: "none" }}
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function pageWrap(): React.CSSProperties {
  return { width: "100%", padding: "4px 20px 28px", boxSizing: "border-box" };
}

function headerRow(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 18,
  };
}

function titleStyle(): React.CSSProperties {
  return { margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" };
}

function subtitleStyle(): React.CSSProperties {
  return { margin: "6px 0 0", fontSize: 13, color: "#64748b", maxWidth: 520 };
}

function kpiGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 14,
    marginBottom: 16,
  };
}

function kpiCard(bg: string, accent: string): React.CSSProperties {
  return {
    background: bg,
    borderRadius: 12,
    padding: 16,
    border: `1px solid ${accent}22`,
    boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
  };
}

function kpiLabel(): React.CSSProperties {
  return { fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4 };
}

function kpiValue(): React.CSSProperties {
  return { marginTop: 8, fontSize: 24, fontWeight: 900, color: "#0f172a" };
}

function kpiFoot(): React.CSSProperties {
  return { marginTop: 10, fontSize: 12, color: "#475569", fontWeight: 600 };
}

function bottomGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
    gap: 16,
    alignItems: "start",
  };
}

function card(): React.CSSProperties {
  return {
    background: "#fff",
    borderRadius: 12,
    padding: 18,
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 4px rgba(15,23,42,0.04)",
    boxSizing: "border-box",
  };
}

function cardTitle(): React.CSSProperties {
  return { margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" };
}

function cardSub(): React.CSSProperties {
  return { margin: "6px 0 0", fontSize: 12, color: "#64748b" };
}

function btnOutline(): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 8,
    border: `2px solid ${APP_TEAL}`,
    background: "#fff",
    color: APP_TEAL,
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 14,
  };
}

function btnSolid(): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: APP_TEAL,
    color: "#fff",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 14,
  };
}

function agingLinkPill(color: string): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    border: `1px solid ${color}55`,
    background: `${color}14`,
    color,
    fontSize: 12,
    fontWeight: 700,
    textDecoration: "none",
  };
}

function urgentRow(days: number): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: "12px 14px",
    marginTop: 8,
    borderRadius: 8,
    border: `1px solid ${days >= 60 ? "#fecaca" : "#fed7aa"}`,
    background: days >= 60 ? "#fef2f2" : "#fff7ed",
    textDecoration: "none",
    color: "inherit",
  };
}

function urgentColor(days: number): string {
  if (days >= 60) return "#991b1b";
  if (days >= 31) return "#c2410c";
  return "#b45309";
}

function th(): React.CSSProperties {
  return { padding: "10px 12px", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" };
}

function td(): React.CSSProperties {
  return { padding: "12px", verticalAlign: "top" };
}
