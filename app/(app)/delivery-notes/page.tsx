import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import DeliveryNotesFiltersClient from "./delivery-notes-filters-client";
import DeliveryNotesListFooterClient from "./delivery-notes-list-footer-client";
import AppHeaderNav from "../components/app-header-nav";
import { APP_BORDER, APP_TEAL } from "../components/app-ui-tokens";
import { formPrimaryButton, tableActionSecondary } from "../components/app-action-buttons";
import { listTableStyles } from "../components/list-page-layout";
import TableEmptyState from "../components/table-empty-state";
import {
  listPageContentCard,
  listPageHeaderActions,
  listPageHeaderRow,
  listPageCardHeading,
  listPageShell,
  listPageSubtitle,
  listPageTitle,
} from "../components/list-page-shell-styles";

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
  if (q) countQ = countQ.or(`sj_number.ilike.%${q}%,customer_name.ilike.%${q}%`);

  const { count: totalCount, error: countErr } = await countQ;
  const totalRows = totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  let dataQ = supabase
    .from("delivery_notes")
    .select("id, sj_number, sj_date, status, invoice_id, customer_name, invoices(invoice_number, customer_name)")
    .order("created_at", { ascending: false })
    .range(fromIdx, toIdx);
  if (q) dataQ = dataQ.or(`sj_number.ilike.%${q}%,customer_name.ilike.%${q}%`);

  const { data: rows, error } = await dataQ;

  const currentParams = new URLSearchParams();
  if (sp.q) currentParams.set("q", sp.q);
  if (sp.ps) currentParams.set("ps", sp.ps);
  const firstUrl = buildUrl(currentParams, { p: "1" });
  const prevUrl = buildUrl(currentParams, { p: String(Math.max(1, page - 1)) });
  const nextUrl = buildUrl(currentParams, { p: String(Math.min(totalPages, page + 1)) });
  const lastUrl = buildUrl(currentParams, { p: String(totalPages) });

  return (
    <div className="app-list-page" style={listPageShell}>
      <div className="app-list-page__header" style={listPageHeaderRow}>
        <div style={{ minWidth: 0 }}>
          <h1 style={listPageTitle}>Surat Jalan</h1>
          <div style={listPageSubtitle}>
            Dari invoice atau manual — posting SJ dapat memicu stok sesuai pengaturan organisasi
          </div>
        </div>
        <div className="app-list-page__header-actions" style={listPageHeaderActions}>
          <Link href="/delivery-notes/new" style={formPrimaryButton()}>
            + Buat Surat Jalan Manual
          </Link>
          <Link href="/dashboard" style={btnOutline()}>
            Dashboard
          </Link>
          <Link href="/invoice" style={btnOutline()}>
            Invoice
          </Link>
          <AppHeaderNav />
        </div>
      </div>

      <div className="app-list-page__card" style={listPageContentCard}>
        <div className="app-list-page__card-title" style={listPageCardHeading}>
          Master Data Surat Jalan
        </div>

        <div style={{ marginBottom: 16 }}>
          <DeliveryNotesFiltersClient />
        </div>

        {countErr ? (
          <div style={{ marginBottom: 14, ...errBox() }}>{countErr.message}</div>
        ) : null}

        <div className="app-table-scroll">
          <table className="app-data-table app-table--delivery-notes" style={listTableStyles.table}>
            <thead>
              <tr style={listTableStyles.thead}>
                <th style={{ ...listTableStyles.th, minWidth: 180 }}>Nomor SJ</th>
                <th style={listTableStyles.th}>Tanggal</th>
                <th style={{ ...listTableStyles.th, minWidth: 180 }}>Invoice</th>
                <th style={{ ...listTableStyles.th, minWidth: 180 }}>Customer</th>
                <th style={{ ...listTableStyles.th, textAlign: "center" }}>Status</th>
                <th style={{ ...listTableStyles.th, minWidth: 230 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((r: any) => {
                const badge = badgeStyle(r.status);
                return (
                  <tr key={r.id}>
                    <td style={{ ...listTableStyles.td, fontWeight: 800, color: "#0f172a" }}>
                      {r.sj_number || "-"}
                    </td>
                    <td style={listTableStyles.td}>{r.sj_date || "-"}</td>
                    <td style={listTableStyles.td}>
                      {r.invoices?.invoice_number || (r.invoice_id ? "-" : "Manual")}
                    </td>
                    <td style={listTableStyles.td}>{r.customer_name || r.invoices?.customer_name || "-"}</td>
                    <td style={{ ...listTableStyles.tdCenter, verticalAlign: "middle" }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 800,
                          letterSpacing: "0.04em",
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          color: badge.color,
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="app-td-actions" style={listTableStyles.td}>
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
                <TableEmptyState colSpan={6} message="Belum ada surat jalan." />
              ) : null}
            </tbody>
          </table>
        </div>

        <DeliveryNotesListFooterClient
          pageSize={pageSize}
          totalRows={totalRows}
          fromIdx={fromIdx}
          toIdx={toIdx}
          page={page}
          totalPages={totalPages}
          prevUrl={prevUrl}
          nextUrl={nextUrl}
          firstUrl={firstUrl}
          lastUrl={lastUrl}
        />
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

function errBox(): React.CSSProperties {
  return { padding: 12, borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 700 };
}
