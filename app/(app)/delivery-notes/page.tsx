import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import DeliveryNotesFiltersClient from "./delivery-notes-filters-client";

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

  const paginationUrls = { firstUrl, prevUrl, nextUrl, lastUrl };

  return (
    <div style={{ width: "100%", padding: 24, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Surat Jalan</h1>
          <div style={{ color: "#666", marginTop: 4 }}>
            Dibuat dari invoice dan bisa jadi trigger stok sesuai pengaturan organisasi
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/dashboard" style={btnSoftLink()}>Dashboard</Link>
          <Link href="/invoice" style={btnSoftLink()}>Invoice</Link>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: "1px solid #eee", background: "white" }}>
        <DeliveryNotesFiltersClient />
      </div>

      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, color: "#666", fontSize: 13 }}>
        <div>Total: <b>{totalRows}</b> • Page: <b>{Math.min(page, totalPages)}</b> / <b>{totalPages}</b> • Per page: <b>{pageSize}</b></div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={firstUrl} style={pagerBtn()}>« First</Link>
          <Link href={prevUrl} style={pagerBtn()}>‹ Prev</Link>
          <Link href={nextUrl} style={pagerBtn()}>Next ›</Link>
          <Link href={lastUrl} style={pagerBtn()}>Last »</Link>
        </div>
      </div>

      {countErr ? (
        <div style={{ marginTop: 14, ...errBox() }}>{countErr.message}</div>
      ) : null}

      <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 14, overflowX: "auto", background: "white" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#fafafa", color: "#555" }}>
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
                <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={tdStrong()}>{r.sj_number || "-"}</td>
                  <td style={td()}>{r.sj_date || "-"}</td>
                  <td style={td()}>{r.invoices?.invoice_number || "-"}</td>
                  <td style={td()}>{r.invoices?.customer_name || "-"}</td>
                  <td style={{ ...td(), textAlign: "center" }}>
                    <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800, background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color }}>{badge.label}</span>
                  </td>
                  <td style={td()}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link href={`/delivery-notes/${r.id}`} style={miniBtn()}>View</Link>
                      <a href={`/api/delivery-notes/pdf/${r.id}`} style={miniBtn()} target="_blank" rel="noreferrer">PDF</a>
                      <a href={`/api/delivery-notes/pdf-dotmatrix/${r.id}`} style={miniBtn()} target="_blank" rel="noreferrer">Dotmatrix</a>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(rows || []).length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...td(), textAlign: "center", color: "#666", padding: 20 }}>Belum ada Surat Jalan.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, color: "#666", fontSize: 13 }}>
        <div>Menampilkan <b>{Math.min(fromIdx + 1, totalRows)}</b>–<b>{Math.min(toIdx + 1, totalRows)}</b> dari <b>{totalRows}</b></div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={firstUrl} style={pagerBtn()}>« First</Link>
          <Link href={prevUrl} style={pagerBtn()}>‹ Prev</Link>
          <Link href={nextUrl} style={pagerBtn()}>Next ›</Link>
          <Link href={lastUrl} style={pagerBtn()}>Last »</Link>
        </div>
      </div>
    </div>
  );
}

function btnSoftLink(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", textDecoration: "none", color: "#111", fontWeight: 600 };
}
function pagerBtn(): React.CSSProperties {
  return { padding: "8px 10px", borderRadius: 10, border: "1px solid #eee", textDecoration: "none", color: "#111", background: "white" };
}
function miniBtn(): React.CSSProperties {
  return { padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", background: "white", textDecoration: "none", color: "#111", fontWeight: 600, fontSize: 13 };
}
function th(): React.CSSProperties {
  return { textAlign: "left", padding: 12, borderBottom: "1px solid #eee", color: "#666", fontWeight: 700, whiteSpace: "nowrap" };
}
function td(): React.CSSProperties {
  return { padding: 12, borderBottom: "1px solid #f2f2f2", verticalAlign: "middle" };
}
function tdStrong(): React.CSSProperties {
  return { ...td(), fontWeight: 800, color: "#111" };
}
function errBox(): React.CSSProperties {
  return { padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 700 };
}
