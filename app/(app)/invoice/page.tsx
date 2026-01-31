// app/invoice/page.tsx  (FULL REPLACE - percent-only)
// NOTE: list invoice + quick payment
export const runtime = "nodejs";

import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import InvoiceFiltersClient from "./filters-client";
import InvoiceActionsClient from "./invoice-actions-client";

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

function getPayStatus(grandTotal: number, amountPaid: number) {
  if (grandTotal <= 0) return "UNPAID";
  if (amountPaid >= grandTotal) return "PAID";
  if (amountPaid > 0) return "PARTIAL";
  return "UNPAID";
}

function badgeStyle(status: string) {
  if (status === "PAID")
    return { bg: "#ecfdf5", border: "#6ee7b7", color: "#065f46" };
  if (status === "PARTIAL")
    return { bg: "#eff6ff", border: "#93c5fd", color: "#1e3a8a" };
  return { bg: "#fff7ed", border: "#fdba74", color: "#9a3412" };
}

// ✅ percent-only: discount_value & tax_value = persen (0-100)
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

function buildUrl(current: URLSearchParams, patch: Record<string, string>) {
  const next = new URLSearchParams(current.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (v === "") next.delete(k);
    else next.set(k, v);
  }
  const qs = next.toString();
  return qs ? `/invoice?${qs}` : "/invoice";
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

  // Customers for dropdown
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

  // current params for pagination links
  const currentParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp || {})) {
    if (v) currentParams.set(k, String(v));
  }

  // COUNT query (server-side filters only)
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

  // DATA query (✅ percent-only: ambil discount_value & tax_value saja)
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
      amount_paid,
      discount_value,
      tax_value,
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
      const payStatus = getPayStatus(t.grandTotal, t.paid);
      return { ...inv, ...t, payStatus };
    })
    .filter((inv: any) => {
      if (sp.pay && inv.payStatus !== sp.pay) return false;
      return true;
    });

  // pagination links
  const prevUrl = buildUrl(currentParams, { p: String(Math.max(1, page - 1)) });
  const nextUrl = buildUrl(currentParams, { p: String(Math.min(totalPages, page + 1)) });
  const firstUrl = buildUrl(currentParams, { p: "1" });
  const lastUrl = buildUrl(currentParams, { p: String(totalPages) });

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Invoice</h1>
          <div style={{ color: "#666", marginTop: 4 }}>
            Quick payment langsung dari list
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link
            href="/invoice"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "white",
              textDecoration: "none",
              color: "#111",
              fontWeight: 600,
            }}
          >
            Reset URL
          </Link>

          <Link
            href="/invoice/new"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "#111",
              color: "white",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            + Invoice Baru
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 14,
          border: "1px solid #eee",
          background: "white",
        }}
      >
        <InvoiceFiltersClient customers={(customers || []) as any} />
      </div>

      {/* Pagination top */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          color: "#666",
          fontSize: 13,
        }}
      >
        <div>
          Total: <b>{totalRows}</b> • Page: <b>{Math.min(page, totalPages)}</b> /{" "}
          <b>{totalPages}</b> • Per page: <b>{pageSize}</b>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href={firstUrl} style={pagerBtn()}>« First</Link>
          <Link href={prevUrl} style={pagerBtn()}>‹ Prev</Link>
          <Link href={nextUrl} style={pagerBtn()}>Next ›</Link>
          <Link href={lastUrl} style={pagerBtn()}>Last »</Link>
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          marginTop: 14,
          border: "1px solid #eee",
          borderRadius: 14,
          overflowX: "auto",
          background: "white",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#fafafa", color: "#555" }}>
              <th style={{ padding: 12, textAlign: "left" }}>Invoice No.</th>
              <th style={{ padding: 12, textAlign: "left" }}>Pelanggan</th>
              <th style={{ padding: 12, textAlign: "center" }}>Status</th>
              <th style={{ padding: 12, textAlign: "right" }}>Jumlah</th>
              <th style={{ padding: 12, textAlign: "right" }}>Terbayar</th>
              <th style={{ padding: 12, textAlign: "right" }}>Terhutang</th>
              <th style={{ padding: 12, textAlign: "left" }}>Tanggal</th>
              <th style={{ padding: 12, textAlign: "left" }}>Aksi</th>
            </tr>
          </thead>

          <tbody>
            {(invoices || []).map((inv: any) => {
              const badge = badgeStyle(inv.payStatus);
              const customerName = inv?.customers?.name || inv.customer_name || "-";

              return (
                <tr key={inv.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: 12 }}>
                    <Link
                      href={`/invoice/${inv.id}`}
                      style={{ fontWeight: 800, textDecoration: "none", color: "#111" }}
                    >
                      {inv.invoice_number || "(Tanpa Nomor)"}
                    </Link>
                  </td>

                  <td style={{ padding: 12 }}>{customerName}</td>

                  <td style={{ padding: 12, textAlign: "center" }}>
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
                      {inv.payStatus}
                    </span>
                  </td>

                  <td style={{ padding: 12, textAlign: "right" }}>{rupiah(inv.grandTotal)}</td>
                  <td style={{ padding: 12, textAlign: "right" }}>{rupiah(inv.paid)}</td>
                  <td style={{ padding: 12, textAlign: "right" }}>{rupiah(inv.remaining)}</td>
                  <td style={{ padding: 12 }}>{inv.invoice_date || "-"}</td>

                  <td style={{ padding: 12, width: 260 }}>
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
              <tr>
                <td colSpan={8} style={{ padding: 20, textAlign: "center", color: "#666" }}>
                  Tidak ada invoice yang cocok dengan filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination bottom */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          color: "#666",
          fontSize: 13,
        }}
      >
        <div>
          Menampilkan <b>{Math.min(fromIdx + 1, totalRows)}</b>–<b>{Math.min(toIdx + 1, totalRows)}</b> dari{" "}
          <b>{totalRows}</b>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href={firstUrl} style={pagerBtn()}>« First</Link>
          <Link href={prevUrl} style={pagerBtn()}>‹ Prev</Link>
          <Link href={nextUrl} style={pagerBtn()}>Next ›</Link>
          <Link href={lastUrl} style={pagerBtn()}>Last »</Link>
        </div>
      </div>
    </div>
  );
}

function pagerBtn(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #eee",
    textDecoration: "none",
    color: "#111",
    background: "white",
  };
}