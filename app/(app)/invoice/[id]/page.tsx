export const runtime = "nodejs";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import BackButton from "../back-button-client";
import PaymentsClient from "../payments-client";
import PdfButtonClient from "../pdf-button-client";
import SjButtonClient from "../sj-button-client";
import DotmatrixButtonClient from "../dotmatrix-button-client";
import CancelInvoiceButtonClient from "../cancel-invoice-button-client";
import SentInvoiceButtonClient from "../sent-invoice-button-client";

type PageProps = {
  params: Promise<{ id: string }>;
};

function rupiah(n: number) {
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(safe);
}

function clampPercent(v: any) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.floor(n)));
}

function safeInt(v: any) {
  const n = Math.floor(Number(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function fmtDate(iso: any) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default async function InvoiceViewPage({ params }: PageProps) {
  const { id } = await params;

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

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select(
      `
      id,
      invoice_number,
      invoice_date,
      due_date,
      status,
      customer_name,
      customer_phone,
      customer_address,
      note,
      discount_type,
      discount_value,
      tax_value,
      amount_paid,
      quotation_id,
      warehouse_id,
      sent_at
    `
    )
    .eq("id", id)
    .single();

  if (invErr || !invoice) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Invoice tidak ditemukan / tidak punya akses</h2>
        <div style={{ marginTop: 8, color: "#666" }}>{invErr?.message}</div>
      </div>
    );
  }

  const { data: items } = await supabase
    .from("invoice_items")
    .select("id, name, item_key, unit, qty, price, sort_order")
    .eq("invoice_id", id)
    .order("sort_order", { ascending: true });

  const subtotal =
    (items || []).reduce(
      (acc, it: any) => acc + Number(it.qty || 0) * Number(it.price || 0),
      0
    ) || 0;

  const dtRaw = String((invoice as any).discount_type || "percent").toLowerCase();
  const discountType: "percent" | "amount" =
    dtRaw === "amount" || dtRaw === "fixed" ? "amount" : "percent";

  const rawDiscountValue = safeInt((invoice as any).discount_value);
  const discPct = discountType === "percent" ? clampPercent(rawDiscountValue) : 0;

  const discount =
    discountType === "percent"
      ? Math.max(0, Math.floor(subtotal * (discPct / 100)))
      : Math.max(0, Math.min(subtotal, Math.floor(rawDiscountValue)));

  const taxPct = clampPercent((invoice as any).tax_value);

  const afterDisc = Math.max(0, subtotal - discount);
  const tax = Math.max(0, Math.floor(afterDisc * (taxPct / 100)));
  const grandTotal = Math.max(0, afterDisc + tax);

  const amountPaid = Math.max(0, Number((invoice as any).amount_paid || 0));
  const remaining = Math.max(0, grandTotal - amountPaid);

  let payLabel = "UNPAID";
  let payBg = "#fff7ed";
  let payBorder = "#fdba74";
  let payColor = "#9a3412";

  if (remaining <= 0 && grandTotal > 0) {
    payLabel = "PAID";
    payBg = "#ecfdf5";
    payBorder = "#6ee7b7";
    payColor = "#065f46";
  } else if (amountPaid > 0 && remaining > 0) {
    payLabel = "PARTIAL";
    payBg = "#eff6ff";
    payBorder = "#93c5fd";
    payColor = "#1e3a8a";
  }

  const discountLabel =
    discountType === "percent" ? `Diskon (${discPct}%)` : "Diskon";

  const docStatus = String((invoice as any).status || "").toLowerCase();
  const canCancel =
    amountPaid <= 0 &&
    docStatus !== "paid" &&
    docStatus !== "cancelled";

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <BackButton />

          <PdfButtonClient href={`/api/invoice/pdf/${id}`} />
          <DotmatrixButtonClient href={`/api/invoice/pdf-dotmatrix/${id}`} />
          <SentInvoiceButtonClient
            invoiceId={id}
            invoiceNumber={(invoice as any).invoice_number || null}
            currentStatus={String((invoice as any).status || "")}
          />
          <CancelInvoiceButtonClient
            invoiceId={id}
            invoiceNumber={(invoice as any).invoice_number || null}
            disabled={!canCancel}
          />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
              Invoice {(invoice as any).invoice_number || "-"}
            </h1>
            <div style={{ color: "#666", marginTop: 6 }}>
              Tanggal: {fmtDate((invoice as any).invoice_date)} • Jatuh tempo:{" "}
              {fmtDate((invoice as any).due_date)} • Status dokumen:{" "}
              {String((invoice as any).status || "-")}
            </div>
          </div>

          <div>
            <span
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                background: payBg,
                border: `1px solid ${payBorder}`,
                color: payColor,
              }}
            >
              {payLabel}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <div style={summaryCard()}>
          <div style={summaryLabel()}>Total Invoice</div>
          <div style={summaryValue()}>{rupiah(grandTotal)}</div>
        </div>

        <div style={summaryCard()}>
          <div style={summaryLabel()}>Terbayar</div>
          <div style={summaryValue()}>{rupiah(amountPaid)}</div>
        </div>

        <div style={summaryCard()}>
          <div style={summaryLabel()}>Sisa Belum Dibayar</div>
          <div style={summaryValue()}>{rupiah(remaining)}</div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 14, borderRadius: 14, border: "1px solid #eee" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Customer</div>
        <div style={{ display: "grid", gap: 4 }}>
          <div>
            <span style={{ color: "#666" }}>Nama:</span>{" "}
            {(invoice as any).customer_name || "-"}
          </div>
          <div>
            <span style={{ color: "#666" }}>Telepon:</span>{" "}
            {(invoice as any).customer_phone || "-"}
          </div>
          <div>
            <span style={{ color: "#666" }}>Alamat:</span>{" "}
            {(invoice as any).customer_address || "-"}
          </div>
          <div>
            <span style={{ color: "#666" }}>Gudang:</span>{" "}
            {(invoice as any).warehouse_id || "-"}
          </div>
          <div>
            <span style={{ color: "#666" }}>Sent At:</span>{" "}
            {(invoice as any).sent_at ? fmtDate((invoice as any).sent_at) : "-"}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 14, borderRadius: 14, border: "1px solid #eee" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Items</div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#666" }}>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Nama</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee", width: 180 }}>Key</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee", width: 100 }}>Qty</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee", width: 100 }}>Unit</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee", width: 160 }}>Harga</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee", width: 180 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {(items || []).map((it: any) => {
                const lineTotal = Number(it.qty || 0) * Number(it.price || 0);
                return (
                  <tr key={it.id}>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                      {it.name}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        borderBottom: "1px solid #f3f3f3",
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      }}
                    >
                      {it.item_key || "-"}
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                      {Number(it.qty || 0)}
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                      {it.unit || "-"}
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                      {rupiah(Number(it.price || 0))}
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                      {rupiah(lineTotal)}
                    </td>
                  </tr>
                );
              })}

              {!items?.length && (
                <tr>
                  <td colSpan={6} style={{ padding: 12, color: "#666" }}>
                    Belum ada item.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 6, maxWidth: 420, marginLeft: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>Subtotal</span>
            <b>{rupiah(subtotal)}</b>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>{discountLabel}</span>
            <b>- {rupiah(discount)}</b>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>Pajak ({taxPct}%)</span>
            <b>{rupiah(tax)}</b>
          </div>

          <div style={{ height: 1, background: "#eee", margin: "6px 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16 }}>
            <span style={{ fontWeight: 800 }}>Grand Total</span>
            <span style={{ fontWeight: 800 }}>{rupiah(grandTotal)}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 14, borderRadius: 14, border: "1px solid #eee" }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Catatan</div>
        <div style={{ color: "#333" }}>{(invoice as any).note || "-"}</div>
      </div>

      <div style={{ marginTop: 16 }}>
        <SjButtonClient invoiceId={id} />
      </div>

      <div style={{ marginTop: 16 }}>
        <PaymentsClient invoiceId={id} />
      </div>
    </div>
  );
}

function summaryCard(): React.CSSProperties {
  return {
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 14,
    background: "white",
  };
}

function summaryLabel(): React.CSSProperties {
  return {
    color: "#666",
    fontSize: 13,
    marginBottom: 4,
  };
}

function summaryValue(): React.CSSProperties {
  return {
    fontWeight: 800,
    fontSize: 16,
    color: "#111",
  };
}