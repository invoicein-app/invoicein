export const runtime = "nodejs";

import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import InvoiceFiltersClient from "./filters-client";
import InvoiceActionsClient from "./invoice-actions-client";
import InvoiceBookkeepingToggle from "./invoice-bookkeeping-toggle";
import InvoicePaginationClient from "./invoice-pagination-client";
import TableEmptyState from "../components/table-empty-state";

type SearchParams = {
  inv?: string;
  custId?: string;
  pay?: string;
  from?: string;
  to?: string;
  p?: string;
  ps?: string;
};

function rupiah(n: number) {
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(safe);
}

function parseIntSafe(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function clampPct(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function calcTotals(inv: any) {
  const items = inv.invoice_items || [];
  const subtotal =
    items.reduce(
      (acc: number, it: any) =>
        acc + Number(it.qty || 0) * Number(it.price || 0),
      0
    ) || 0;

  const discPct = clampPct(inv.discount_value);
  const discount = subtotal * (discPct / 100);

  const afterDisc = Math.max(0, subtotal - discount);

  const taxPct = clampPct(inv.tax_value);
  const tax = afterDisc * (taxPct / 100);

  const grandTotal = Math.max(0, afterDisc + tax);
  const paid = Math.max(0, Number(inv.amount_paid || 0));
  const remaining = Math.max(0, grandTotal - paid);

  return { subtotal, grandTotal, paid, remaining };
}

function getUiPayStatus(rawStatus: any, grandTotal: number, amountPaid: number) {
  const status = String(rawStatus || "").toLowerCase();

  if (status === "cancelled") return "CANCELLED";
  if (status === "draft") return "DRAFT";
  if (status === "paid") return "PAID";

  if (grandTotal <= 0) return "UNPAID";
  if (amountPaid >= grandTotal) return "PAID";
  if (amountPaid > 0) return "PARTIAL";
  return "UNPAID";
}

function badgeStyle(status: string) {
  if (status === "PAID") {
    return { bg: "#e8f5e9", border: "#a5d6a7", color: "#1b5e20" };
  }
  if (status === "PARTIAL") {
    return { bg: "#fff4e5", border: "#fdba74", color: "#c2410c" };
  }
  if (status === "CANCELLED") {
    return { bg: "#ffebee", border: "#ef9a9a", color: "#c62828" };
  }
  if (status === "DRAFT") {
    return { bg: "#f3f4f6", border: "#e5e7eb", color: "#4b5563" };
  }
  if (status === "UNPAID") {
    return { bg: "#ffebee", border: "#ffcdd2", color: "#c62828" };
  }
  return { bg: "#fff7ed", border: "#fdba74", color: "#9a3412" };
}

function formatTanggalIndo(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export default async function InvoiceListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const pageSize = Math.min(parseIntSafe(sp.ps, 20), 50);
  const page = Math.max(parseIntSafe(sp.p, 1), 1);
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Kamu belum login</h2>
      </div>
    );
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("show_invoice_bookkeeping_status")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const showBookkeepingStatus = Boolean(membership?.show_invoice_bookkeeping_status);

  const { data: customers, error: custErr } = await supabase
    .from("customers")
    .select("id, name")
    .order("name", { ascending: true });

  if (custErr) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Error load customers</h2>
        <pre style={{ color: "#c00" }}>{custErr.message}</pre>
      </div>
    );
  }

  const currentParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp || {})) {
    if (v) currentParams.set(k, String(v));
  }

  let countQ = supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .order("invoice_date", { ascending: false });

  if (sp.inv) countQ = countQ.ilike("invoice_number", `%${sp.inv}%`);
  if (sp.custId) countQ = countQ.eq("customer_id", sp.custId);
  if (sp.from) countQ = countQ.gte("invoice_date", sp.from);
  if (sp.to) countQ = countQ.lte("invoice_date", sp.to);

  const { count: totalCount, error: countErr } = await countQ;

  if (countErr) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Error count invoice</h2>
        <pre style={{ color: "#c00" }}>{countErr.message}</pre>
      </div>
    );
  }

  const totalRows = totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  let dataQ = supabase
    .from("invoices")
    .select(
      `
      id,
      invoice_number,
      quotation_id,
      invoice_date,
      customer_id,
      customer_name,
      status,
      amount_paid,
      discount_value,
      tax_value,
      bookkeeping_recorded,
      customers ( name ),
      invoice_items ( qty, price )
    `
    )
    .order("invoice_date", { ascending: false })
    .range(fromIdx, toIdx);

  if (sp.inv) dataQ = dataQ.ilike("invoice_number", `%${sp.inv}%`);
  if (sp.custId) dataQ = dataQ.eq("customer_id", sp.custId);
  if (sp.from) dataQ = dataQ.gte("invoice_date", sp.from);
  if (sp.to) dataQ = dataQ.lte("invoice_date", sp.to);

  const { data: invoicesRaw, error: dataErr } = await dataQ;

  if (dataErr) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Error load invoice</h2>
        <pre style={{ color: "#c00" }}>{dataErr.message}</pre>
      </div>
    );
  }

  const invoices = (invoicesRaw || [])
    .map((inv: any) => {
      const t = calcTotals(inv);
      const payStatus = getUiPayStatus(inv.status, t.grandTotal, t.paid);
      return { ...inv, ...t, payStatus };
    })
    .filter((inv: any) => {
      if (sp.pay && inv.payStatus !== sp.pay) return false;
      return true;
    });

  const TEAL = "#2D7D71";
  const baseQuery = currentParams.toString();
  const tableColSpan = showBookkeepingStatus ? 8 : 7;

  return (
    <div
      className="invoice-list-page"
      style={{ width: "100%", padding: "16px 20px 40px", boxSizing: "border-box", background: "#F8F9FA", minHeight: "100%" }}
    >
      {/* Page title row (main content header) */}
      <div
        className="invoice-page__topbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#333" }}>Invoice</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/settings/activity"
            title="Notifikasi / aktivitas"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(45, 125, 113, 0.12)",
              display: "grid",
              placeItems: "center",
              textDecoration: "none",
              border: "1px solid rgba(45, 125, 113, 0.22)",
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.8" aria-hidden>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </Link>
          <Link
            href="/settings"
            title="Profil & pengaturan"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(45, 125, 113, 0.12)",
              display: "grid",
              placeItems: "center",
              textDecoration: "none",
              border: "1px solid rgba(45, 125, 113, 0.22)",
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.8" aria-hidden>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1" strokeLinecap="round" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Main card */}
      <div
        className="invoice-list-card"
        style={{
          borderRadius: 10,
          border: "1px solid #e5e7eb",
          background: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          padding: "22px 22px 8px",
          boxSizing: "border-box",
        }}
      >
        <InvoiceFiltersClient customers={(customers || []) as any} />

        <div className="invoice-table-scroll">
          <table className="invoice-list-table app-table--invoice-list">
            <thead>
              <tr>
                <th className="inv-th inv-th--number">Nomor Invoice</th>
                <th className="inv-th inv-th--status">Status</th>
                <th className="inv-th inv-th--customer">Pelanggan</th>
                <th className="inv-th inv-th--amount">Jumlah</th>
                <th className="inv-th inv-th--amount">Terbayar</th>
                <th className="inv-th inv-th--amount">Terhutang</th>
                {showBookkeepingStatus ? (
                  <th className="inv-th inv-th--bookkeeping">Pencatatan</th>
                ) : null}
                <th className="inv-th inv-th--actions">Aksi</th>
              </tr>
            </thead>

            <tbody>
              {(invoices || []).map((inv: any) => {
                const badge = badgeStyle(inv.payStatus);
                const customerName = inv?.customers?.name || inv.customer_name || "-";
                const invLabel = inv.invoice_number || "(Tanpa nomor)";

                return (
                  <tr key={inv.id}>
                    <td className="inv-td inv-td--number">
                      <Link href={`/invoice/${inv.id}`} className="inv-number-link">
                        {invLabel}
                      </Link>
                      <div className="inv-number-meta">
                        Tanggal: {formatTanggalIndo(inv.invoice_date)}
                      </div>
                    </td>

                    <td className="inv-td inv-td--status">
                      <span
                        className="inv-status-badge"
                        style={{
                          background: badge.bg,
                          borderColor: badge.border,
                          color: badge.color,
                        }}
                      >
                        {inv.payStatus}
                      </span>
                    </td>

                    <td className="inv-td inv-td--customer">{customerName}</td>

                    <td className="inv-td inv-td--amount">
                      <span className="inv-money">{rupiah(inv.grandTotal)}</span>
                    </td>
                    <td className="inv-td inv-td--amount">
                      <span className="inv-money">{rupiah(inv.paid)}</span>
                    </td>
                    <td className="inv-td inv-td--amount">
                      <span className="inv-money">{rupiah(inv.remaining)}</span>
                    </td>

                    {showBookkeepingStatus ? (
                      <td className="inv-td inv-td--bookkeeping">
                        <InvoiceBookkeepingToggle
                          invoiceId={inv.id}
                          initialRecorded={Boolean(inv.bookkeeping_recorded)}
                        />
                      </td>
                    ) : null}

                    <td className="inv-td inv-td--actions app-td-actions">
                      <InvoiceActionsClient
                        id={inv.id}
                        invoiceNumber={inv.invoice_number}
                        remaining={inv.remaining}
                        payStatus={inv.payStatus}
                        hasQuotation={Boolean(inv.quotation_id)}
                      />
                    </td>
                  </tr>
                );
              })}

              {!invoices?.length && (
                <TableEmptyState colSpan={tableColSpan} message="Belum ada invoice." />
              )}
            </tbody>
          </table>
        </div>

        <InvoicePaginationClient
          page={page}
          totalPages={totalPages}
          totalRows={totalRows}
          pageSize={pageSize}
          baseQuery={baseQuery}
        />
      </div>
    </div>
  );
}
