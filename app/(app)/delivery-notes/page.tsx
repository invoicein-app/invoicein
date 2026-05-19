import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import DeliveryNotesFiltersClient from "./delivery-notes-filters-client";
import AppHeaderNav from "../components/app-header-nav";
import { APP_BORDER, APP_BG, APP_TEAL } from "../components/app-ui-tokens";
import { tableActionSecondary } from "../components/app-action-buttons";

function badgeStyle(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "posted") return { bg: "#ecfdf5", border: "#6ee7b7", color: "#065f46", label: "POSTED" };
  if (s === "cancelled") return { bg: "#fef2f2", border: "#fca5a5", color: "#991b1b", label: "CANCELLED" };
  return { bg: "#f3f4f6", border: "#d1d5db", color: "#374151", label: "DRAFT" };
}

function parseIntSafe(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function buildUrl(current: URLSearchParams, patch: Record<string, string>) {
  const next = new URLSearchParams(current.toString());
  for (const [k, val] of Object.entries(patch)) {
    if (val === "") next.delete(k);
    else next.set(k, val);
  }
  const qs = next.toString();
  return qs ? `/delivery-notes?${qs}` : "/delivery-notes";
}

export default async function DeliveryNotesListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string; ps?: string }>;
}) {
  const sp = await searchParams;
  const pageSize = Math.min(parseIntSafe(sp.ps, 20), 50);
  const page = Math.max(parseIntSafe(sp.p, 1), 1);
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;
  const q = (sp.q || "").trim();

  const supabase = await supabaseServer();

  let countQ = supabase
    .from("delivery_notes")
    .select("id", { count: "exact", head: true })
    .order("created_at", { ascending: false });
  if (q) countQ = countQ.ilike("sj_number", `%${q}%`);

  const { count: totalCount, error: countErr } = await countQ;
  const totalRows = totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  let dataQ = supabase
    .from("delivery_notes")
    .select("id, sj_number, sj_date, status, invoice_id, invoices(invoice_number, customer_name)")
    .order("created_at", { ascending: false })
    .range(fromIdx, toIdx);
  if (q) dataQ = dataQ.ilike("sj_number", `%${q}%`);

  const { data: rows, error } = await dataQ;

  const currentParams = new URLSearchParams();
  if (sp.q) currentParams.set("q", sp.q);
  if (sp.ps) currentParams.set("ps", sp.ps);
  const firstUrl = buildUrl(currentParams, { p: "1" });
  const prevUrl = buildUrl(currentParams, { p: String(Math.max(1, page - 1)) });
  const nextUrl = buildUrl(currentParams, { p: String(Math.min(totalPages, page + 1)) });
  const lastUrl = buildUrl(currentParams, { p: String(totalPages) });

  return (
    <div style={{ width: "100%", boxSizing: "border-box", background: APP_BG, minHeight: "100%", padding: "16px 20px 40px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#333" }}>Surat Jalan</h1>
          <div style={{ color: "#64748b", marginTop: 6, fontSize: 14, lineHeight: 1.45, maxWidth: 720 }}>
            Dibuat dari invoice dan bisa jadi trigger stok sesuai pengaturan organisasi
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Link href="/dashboard" style={btnOutline()}>
            Dashboard
          </Link>
          <Link href="/invoice" style={btnOutline()}>
            Invoice
          </Link>
          <AppHeaderNav />
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          border: `1px solid ${APP_BORDER}`,
          borderRadius: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          padding: "20px 20px 8px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: "#333", marginBottom: 16 }}>Master Data Surat Jalan</div>

        <div style={{ marginBottom: 16 }}>
          <DeliveryNotesFiltersClient />
        </div>

        {countErr ? (
          <div style={{ marginBottom: 14, ...errBox() }}>{countErr.message}</div>
        ) : null}

        <div style={{ width: "100%", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 720 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ ...th(), minWidth: 180 }}>Nomor SJ</th>
                <th style={th()}>Tanggal</th>
                <th style={{ ...th(), minWidth: 180 }}>Invoice</th>
                <th style={{ ...th(), minWidth: 180 }}>Customer</th>
                <th style={{ ...th(), textAlign: "center" }}>Status</th>
                <th style={{ ...th(), minWidth: 230 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((r: any) => {
                const badge = badgeStyle(r.status);
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={tdStrong()}>{r.sj_number || "-"}</td>
                    <td style={td()}>{r.sj_date || "-"}</td>
                    <td style={td()}>{r.invoices?.invoice_number || "-"}</td>
                    <td style={td()}>{r.invoices?.customer_name || "-"}</td>
                    <td style={{ ...td(), textAlign: "center" }}>
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
                    <td style={td()}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Link href={`/delivery-notes/${r.id}`} style={tableActionSecondary()}>
                          View
                        </Link>
                        <a href={`/api/delivery-notes/pdf/${r.id}`} style={tableActionSecondary()} target="_blank" rel="noreferrer">
                          PDF
                        </a>
                        <a href={`/api/delivery-notes/pdf-dotmatrix/${r.id}`} style={tableActionSecondary()} target="_blank" rel="noreferrer">
                          Dotmatrix
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(rows || []).length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...td(), textAlign: "center", color: "#94a3b8", padding: 28, fontWeight: 600 }}>
                    Belum ada Surat Jalan.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            marginTop: 16,
            paddingTop: 16,
            paddingBottom: 8,
            borderTop: `1px solid ${APP_BORDER}`,
            fontSize: 13,
            color: "#64748b",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>Menampilkan</span>
            <b style={{ color: "#333" }}>{pageSize}</b>
            <span>
              Dari <b style={{ color: "#333" }}>{totalRows}</b> Data
            </span>
            {totalRows > 0 ? (
              <span style={{ color: "#94a3b8" }}>
                ({Math.min(fromIdx + 1, totalRows)}–{Math.min(toIdx + 1, totalRows)})
              </span>
            ) : null}
          </div>

          <nav style={{ display: "flex", alignItems: "center", gap: 8 }} aria-label="Pagination">
            {page <= 1 ? (
              <span style={pagerDisabled()}>&lt; Prev</span>
            ) : (
              <Link href={prevUrl} style={pagerBtn()}>
                &lt; Prev
              </Link>
            )}
            <span style={pagerActive()}>{page}</span>
            {page >= totalPages ? (
              <span style={pagerDisabled()}>Next &gt;</span>
            ) : (
              <Link href={nextUrl} style={pagerBtn()}>
                Next &gt;
              </Link>
            )}
            <span style={{ width: 8 }} />
            {page <= 1 ? (
              <span style={pagerDisabled()}>«</span>
            ) : (
              <Link href={firstUrl} style={pagerBtn()}>
                «
              </Link>
            )}
            {page >= totalPages ? (
              <span style={pagerDisabled()}>»</span>
            ) : (
              <Link href={lastUrl} style={pagerBtn()}>
                »
              </Link>
            )}
          </nav>
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 16, ...errBox() }}>{error.message}</div>
      ) : null}
    </div>
  );
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

function pagerBtn(): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 8,
    border: `1px solid ${APP_BORDER}`,
    background: "#fff",
    color: "#334155",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 600,
  };
}

function pagerActive(): React.CSSProperties {
  return {
    minWidth: 36,
    height: 36,
    display: "inline-grid",
    placeItems: "center",
    padding: "0 10px",
    borderRadius: "50%",
    background: APP_TEAL,
    color: "#fff",
    fontWeight: 800,
    fontSize: 14,
  };
}

function pagerDisabled(): React.CSSProperties {
  return {
    ...pagerBtn(),
    opacity: 0.45,
    pointerEvents: "none",
    cursor: "not-allowed",
  };
}

function th(): React.CSSProperties {
  return {
    textAlign: "left",
    padding: "12px 10px",
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    borderBottom: `1px solid ${APP_BORDER}`,
    whiteSpace: "nowrap",
  };
}

function td(): React.CSSProperties {
  return { padding: "14px 10px", verticalAlign: "middle", color: "#334155" };
}

function tdStrong(): React.CSSProperties {
  return { ...td(), fontWeight: 800, color: "#111" };
}

function errBox(): React.CSSProperties {
  return { padding: 12, borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 700 };
}
