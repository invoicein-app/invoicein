"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import ListPageLayout from "../components/list-page-layout";
import ListFiltersClient from "../components/list-filters-client";
import { listTableStyles } from "../components/list-page-layout";

type QuotationRow = {
  id: string;
  quotation_number: string | null;
  quotation_date: string | null;
  customer_name: string | null;
  subtotal: number | null;
  total: number | null;
  status: string | null;
  invoice_id: string | null;
  is_locked: boolean | null;
};

function fmtMoney(n: any) {
  const v = Number(n);
  const safe = Number.isFinite(v) ? v : 0;
  return safe.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(iso: any) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function statusLabel(status: any) {
  const s = String(status || "draft").toLowerCase();
  if (s === "accepted") return "Accepted";
  if (s === "sent") return "Sent";
  if (s === "rejected") return "Rejected";
  if (s === "draft") return "Draft";
  if (s === "cancelled") return "Cancelled";
  return s ? s[0].toUpperCase() + s.slice(1) : "Draft";
}

function badgeStyle(status: any) {
  const s = String(status || "draft").toLowerCase();
  if (s === "accepted") return { border: "1px solid #16a34a", background: "#dcfce7", color: "#14532d" };
  if (s === "sent") return { border: "1px solid #0284c7", background: "#e0f2fe", color: "#0c4a6e" };
  if (s === "rejected") return { border: "1px solid #dc2626", background: "#fee2e2", color: "#7f1d1d" };
  if (s === "cancelled") return { border: "1px solid #94a3b8", background: "#f1f5f9", color: "#334155" };
  // draft / others
  return { border: "1px solid #9ca3af", background: "#f3f4f6", color: "#111827" };
}

export default function QuotationsListPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [rows, setRows] = useState<QuotationRow[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [convertingId, setConvertingId] = useState<string>("");

  // ✅ map invoice_id -> invoice_number
  const [invoiceNoMap, setInvoiceNoMap] = useState<Record<string, string>>({});

  async function loadInvoiceNumbers(invoiceIds: string[]) {
    const uniq = Array.from(new Set(invoiceIds.filter(Boolean)));
    if (uniq.length === 0) {
      setInvoiceNoMap({});
      return;
    }

    const { data, error } = await supabase
      .from("invoices")
      .select("id,invoice_number")
      .in("id", uniq);

    if (error) {
      // jangan bikin page gagal kalau invoice number gagal
      setInvoiceNoMap({});
      return;
    }

    const map: Record<string, string> = {};
    for (const r of (data || []) as any[]) {
      if (r?.id) map[String(r.id)] = String(r.invoice_number || "");
    }
    setInvoiceNoMap(map);
  }

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        setRows([]);
        setInvoiceNoMap({});
        setErr("Unauthorized");
        return;
      }

      const { data: membership, error: memErr } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (memErr) throw memErr;

      const orgId = String((membership as any)?.org_id || "");
      if (!orgId) {
        setRows([]);
        setInvoiceNoMap({});
        setErr("Org tidak ditemukan. Pastikan membership aktif.");
        return;
      }

      const { data, error } = await supabase
        .from("quotations")
        .select("id,quotation_number,quotation_date,customer_name,subtotal,total,status,invoice_id,is_locked")
        .eq("organization_id", orgId)
        .order("quotation_date", { ascending: false })
        .limit(200);

      if (error) throw error;

      const list = ((data as any) || []) as QuotationRow[];
      setRows(list);

      // ✅ batch fetch invoice_number untuk semua invoice_id yang muncul
      const invoiceIds = list.map((x) => String(x.invoice_id || "")).filter(Boolean);
      await loadInvoiceNumbers(invoiceIds);
    } catch (e: any) {
      setErr(e?.message || "Gagal load quotations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const blob = `${r.quotation_number || ""} ${r.customer_name || ""} ${r.status || ""}`.toLowerCase();
      return blob.includes(s);
    });
  }, [rows, q]);

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;
  const paginated = useMemo(() => filtered.slice(fromIdx, fromIdx + pageSize), [filtered, fromIdx, pageSize]);

  const clientPagination = useMemo(
    () => ({
      onFirst: () => setPage(1),
      onPrev: () => setPage((p) => Math.max(1, p - 1)),
      onNext: () => setPage((p) => Math.min(totalPages, p + 1)),
      onLast: () => setPage(totalPages),
    }),
    [totalPages]
  );

  async function convertToInvoice(id: string) {
    const row = rows.find((x) => x.id === id);
    if (!row) return;

    if (row.invoice_id) {
      router.push(`/invoice/${row.invoice_id}`);
      return;
    }

    if (row.is_locked) {
      alert("Quotation ini sudah locked, tidak bisa di-convert.");
      return;
    }

    const ok = confirm("Convert quotation ini menjadi Invoice? (Quotation akan dikunci)");
    if (!ok) return;

    setConvertingId(id);
    try {
      const res = await fetch(`/api/quotations/convert/${id}`, { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(json?.error || "Gagal convert quotation.");

      const invoiceId = String(json?.invoice_id || "");
      if (invoiceId) {
        await load();
        router.push(`/invoice/${invoiceId}`);
        return;
      }

      const quotationId = String(json?.quotation_id || id);
      if (json?.prefill) {
        await load();
        router.push(`/invoice/new?fromQuotationId=${encodeURIComponent(quotationId)}`);
        return;
      }

      throw new Error("Response convert tidak dikenali (tidak ada invoice_id / prefill).");
    } catch (e: any) {
      alert(e?.message || "Gagal convert.");
    } finally {
      setConvertingId("");
    }
  }

  const filters = (
    <ListFiltersClient
      searchPlaceholder="Cari quotation number / customer / status..."
      searchValue={q}
      onSearchChange={setQ}
      onReset={() => { setQ(""); setPage(1); }}
      perPage={pageSize}
      onPerPageChange={(v) => { setPageSize(v); setPage(1); }}
      perPageOptions={[10, 20, 30, 50]}
    >
      <button type="button" onClick={load} style={btnSoft()} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
    </ListFiltersClient>
  );

  const tableContent = (
    <table style={{ ...listTableStyles.table, minWidth: 960 }}>
      <thead>
        <tr style={listTableStyles.thead}>
          <th style={listTableStyles.th}>No</th>
          <th style={listTableStyles.th}>Tanggal</th>
          <th style={listTableStyles.th}>Customer</th>
          <th style={{ ...listTableStyles.th, textAlign: "right" }}>Total</th>
          <th style={listTableStyles.th}>Status</th>
          <th style={listTableStyles.th}>Aksi</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr><td colSpan={6} style={listTableStyles.td}>Loading...</td></tr>
        ) : paginated.length === 0 ? (
          <tr><td colSpan={6} style={listTableStyles.empty}>Tidak ada data.</td></tr>
        ) : (
          paginated.map((r) => {
                  const st = String(r.status || "draft");
                  const isBusy = convertingId === r.id;

                  const hasInvoice = !!r.invoice_id;
                  const locked = !!r.is_locked;

                  const canConvert = !hasInvoice && !locked;

                  const invNo = r.invoice_id ? invoiceNoMap[String(r.invoice_id)] : "";
                  const invLabel = invNo ? invNo : r.invoice_id ? `${String(r.invoice_id).slice(0, 8)}...` : "";

                  return (
                    <tr key={r.id}>
                      <td style={{ ...listTableStyles.td, fontFamily: "ui-monospace, monospace" }}>
                        <Link href={`/quotations/${r.id}`} style={linkClick()}>
                          {r.quotation_number || "-"}
                        </Link>
                      </td>

                      <td style={listTableStyles.td}>{fmtDate(r.quotation_date)}</td>

                      <td style={listTableStyles.td}>
                        <div style={{ fontWeight: 900 }}>{r.customer_name || "-"}</div>

                        {hasInvoice ? (
                          <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280",display: "flex",gap:4,alignItems:"center",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:260 }}>"
                            invoice:{" "}
                            <Link href={`/invoice/${r.invoice_id}`} style={linkSoft()}>
                              {invLabel}
                            </Link>
                          </div>
                        ) : null}
                      </td>

                      <td style={{ ...listTableStyles.td, textAlign: "right" }}>Rp {fmtMoney(r.total)}</td>

                      <td style={listTableStyles.td}>
                        <span style={{ ...badge(), ...badgeStyle(st) }}>{statusLabel(st)}</span>
                        {locked ? <span style={{ marginLeft: 8, ...miniPill() }}>locked</span> : null}
                      </td>

                      <td style={listTableStyles.td}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "nowrap" }}>
                          <button type="button" onClick={() => router.push(`/quotations/${r.id}`)} style={btnAction()}>
                            Detail
                          </button>
                          <a
                            href={`/api/quotations/pdf/${r.id}?download=1`}
                            target="_blank"
                            rel="noreferrer"
                            style={btnAction()}
                            title="Download Quotation (PDF)"
                          >
                            Download
                          </a>
                          {hasInvoice ? (
                            <button type="button" onClick={() => router.push(`/invoice/${r.invoice_id}`)} style={btnActionPrimary()}>
                              Buka Invoice
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => convertToInvoice(r.id)}
                              style={canConvert ? btnActionPrimary() : btnActionDisabled()}
                              disabled={!canConvert || isBusy}
                              title={locked ? "Quotation locked, tidak bisa convert" : "Convert jadi invoice"}
                            >
                              {isBusy ? "Converting..." : locked ? "Locked" : "Convert → Invoice"}
                            </button>
                          )}
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
      {err ? <div style={{ ...errBox(), margin: "24px 0" }}>{err}</div> : null}
      <ListPageLayout
        title="Quotations"
        subtitle="List quotation yang bisa di-convert jadi invoice."
        primaryLink={{ href: "/quotations/new", label: "+ Buat Quotation" }}
        secondaryLink={{ href: "/invoice", label: "Invoice" }}
        filters={filters}
        totalRows={totalRows}
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        fromIdx={fromIdx}
        toIdx={toIdx}
        clientPagination={clientPagination}
        tableContent={tableContent}
        emptyMessage="Tidak ada data."
      />
    </>
  );
}

/** styles */
function topbar(): React.CSSProperties {
  return { display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 };
}

function card(): React.CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    background: "white",
    borderRadius: 14,
    padding: 14,
    boxShadow: "0 8px 24px rgba(0,0,0,0.05)",
  };
}

function errBox(): React.CSSProperties {
  return { marginBottom: 12, padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 900 };
}

function baseInput(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    outline: "none",
    fontWeight: 800,
    background: "white",
    lineHeight: "20px",
    height: 42,
    boxSizing: "border-box",
  };
}

function inpFull(): React.CSSProperties {
  return { ...baseInput(), width: "100%" };
}

function btnSoft(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "white",
    color: "#111827",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    textDecoration: "none",
    display: "inline-block",
  };
}

function tableWrap(): React.CSSProperties {
  return { width: "100%", overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12 };
}

function table(): React.CSSProperties {
  return { width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 820 };
}

function th(): React.CSSProperties {
  return {
    textAlign: "left",
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 950,
    padding: "10px 12px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
    position: "sticky",
    top: 0,
    zIndex: 1,
  };
}

function thRight(): React.CSSProperties {
  return { ...th(), textAlign: "right" };
}

function td(): React.CSSProperties {
  return { padding: "10px 12px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top", fontWeight: 800, color: "#111827", background: "white" };
}

function tdRight(): React.CSSProperties {
  return { ...td(), textAlign: "right" };
}

function tdMono(): React.CSSProperties {
  return { ...td(), fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" };
}

function badge(): React.CSSProperties {
  return { display: "inline-flex", alignItems: "center", padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 1000, letterSpacing: 0.2 };
}

function miniPill(): React.CSSProperties {
  return { display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 950, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#6b7280", textTransform: "lowercase" };
}

function btnAction(): React.CSSProperties {
  return { padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "white", color: "#475569", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none", flexShrink: 0 };
}
function btnActionPrimary(): React.CSSProperties {
  return { padding: "6px 10px", borderRadius: 8, border: "1px solid #0f172a", background: "#0f172a", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 };
}
function btnActionDisabled(): React.CSSProperties {
  return { padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f1f5f9", color: "#94a3b8", fontSize: 13, fontWeight: 700, cursor: "not-allowed", whiteSpace: "nowrap", flexShrink: 0 };
}

function linkSoft(): React.CSSProperties {
  return { color: "#111827", textDecoration: "underline", fontWeight: 900 };
}

function linkClick(): React.CSSProperties {
  return { color: "#111827", textDecoration: "underline", fontWeight: 1000, cursor: "pointer", pointerEvents: "auto" };
}
