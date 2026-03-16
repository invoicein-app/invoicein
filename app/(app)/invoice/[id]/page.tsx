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
    <div style={pageWrap()}>
      <div style={headerRow()}>
        <div>
          <h1 style={headerTitle()}>
            Invoice {(invoice as any).invoice_number || "-"}
          </h1>
          <p style={headerSub()}>
            Tanggal: {fmtDate((invoice as any).invoice_date)} • Jatuh tempo:{" "}
            {fmtDate((invoice as any).due_date)} • Status:{" "}
            {String((invoice as any).status || "-")}
          </p>
          <div style={headerBadgeWrap()}>
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

        <div style={headerActions()}>
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

      <div style={summaryRow()}>
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

      <div style={sectionGrid()}>
        <div style={card()}>
          <div style={sectionTitle()}>Customer</div>
          <div style={cardBody()}>
            <div style={infoRow()}>
              <span style={infoK()}>Nama</span>
              <span style={infoV()}>{(invoice as any).customer_name || "-"}</span>
            </div>
            <div style={infoRow()}>
              <span style={infoK()}>Telepon</span>
              <span style={infoV()}>{(invoice as any).customer_phone || "-"}</span>
            </div>
            <div style={infoRow()}>
              <span style={infoK()}>Alamat</span>
              <span style={infoV()}>{(invoice as any).customer_address || "-"}</span>
            </div>
            <div style={infoRow()}>
              <span style={infoK()}>Gudang</span>
              <span style={infoV()}>{(invoice as any).warehouse_id || "-"}</span>
            </div>
            <div style={infoRow()}>
              <span style={infoK()}>Sent At</span>
              <span style={infoV()}>{(invoice as any).sent_at ? fmtDate((invoice as any).sent_at) : "-"}</span>
            </div>
          </div>
        </div>

        <div style={card()}>
          <div style={sectionTitle()}>Catatan</div>
          <div style={cardBody()}>
            <div style={noteText()}>{(invoice as any).note || "-"}</div>
          </div>
        </div>
      </div>

      <div style={section()}>
        <div style={card()}>
          <div style={sectionTitle()}>Items</div>
          <div style={cardBody()}>
            <div style={tableScroll()}>
              <table style={table()}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th style={th()}>Nama</th>
                    <th style={th()}>Key</th>
                    <th style={th()}>Qty</th>
                    <th style={th()}>Unit</th>
                    <th style={th()}>Harga</th>
                    <th style={th()}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(items || []).map((it: any) => {
                    const lineTotal = Number(it.qty || 0) * Number(it.price || 0);
                    return (
                      <tr key={it.id}>
                        <td style={td()}>{it.name}</td>
                        <td style={tdMono()}>{it.item_key || "-"}</td>
                        <td style={td()}>{Number(it.qty || 0)}</td>
                        <td style={td()}>{it.unit || "-"}</td>
                        <td style={td()}>{rupiah(Number(it.price || 0))}</td>
                        <td style={td()}>{rupiah(lineTotal)}</td>
                      </tr>
                    );
                  })}
                  {!items?.length && (
                    <tr>
                      <td colSpan={6} style={{ ...td(), color: "#64748b" }}>Belum ada item.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={totalsBlock()}>
              <div style={totalRow()}>
                <span style={totalK()}>Subtotal</span>
                <span style={totalV()}>{rupiah(subtotal)}</span>
              </div>
              <div style={totalRow()}>
                <span style={totalK()}>{discountLabel}</span>
                <span style={totalV()}>- {rupiah(discount)}</span>
              </div>
              <div style={totalRow()}>
                <span style={totalK()}>Pajak ({taxPct}%)</span>
                <span style={totalV()}>{rupiah(tax)}</span>
              </div>
              <div style={totalDivider()} />
              <div style={{ ...totalRow(), ...totalRowStrong() }}>
                <span style={totalK()}>Grand Total</span>
                <span style={totalV()}>{rupiah(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={sectionGrid()}>
        <div style={card()}>
          <div style={sectionTitle()}>Surat Jalan</div>
          <div style={cardBody()}>
            <p style={sectionDesc()}>Buat atau buka surat jalan untuk pengiriman invoice ini.</p>
            <div style={sjButtonWrap()}>
              <SjButtonClient invoiceId={id} />
            </div>
          </div>
        </div>

        <div style={card()}>
          <div style={sectionTitle()}>Pembayaran</div>
          <div style={cardBody()}>
            <PaymentsClient invoiceId={id} />
          </div>
        </div>
      </div>
    </div>
  );
}
const sectionGap = 24;

function pageWrap(): React.CSSProperties {
  return { width: "100%", maxWidth: 1100, margin: "0 auto", padding: 24, boxSizing: "border-box" };
}
function headerRow(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: sectionGap,
  };
}
function headerTitle(): React.CSSProperties {
  return { margin: 0, fontSize: 20, fontWeight: 800, color: "#111827" };
}
function headerSub(): React.CSSProperties {
  return { margin: "6px 0 0", color: "#6b7280", fontSize: 14 };
}
function headerBadgeWrap(): React.CSSProperties {
  return { marginTop: 10 };
}
function headerActions(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    flexShrink: 0,
  };
}
function summaryRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginBottom: sectionGap,
  };
}
function summaryCard(): React.CSSProperties {
  return {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 18,
    background: "white",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  };
}
function summaryLabel(): React.CSSProperties {
  return { color: "#64748b", fontSize: 13, marginBottom: 6, fontWeight: 600 };
}
function summaryValue(): React.CSSProperties {
  return { fontWeight: 800, fontSize: 18, color: "#0f172a" };
}

function section(): React.CSSProperties {
  return { marginBottom: sectionGap };
}
function sectionGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: sectionGap,
    marginBottom: sectionGap,
  };
}
function card(): React.CSSProperties {
  return {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    background: "white",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    overflow: "hidden",
  };
}
function sectionTitle(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    letterSpacing: "0.02em",
    padding: "14px 18px",
    borderBottom: "1px solid #f1f5f9",
    background: "#f8fafc",
  };
}
function cardBody(): React.CSSProperties {
  return { padding: 18 };
}
function infoRow(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "100px 1fr", gap: 8, marginBottom: 10 };
}
function infoK(): React.CSSProperties {
  return { fontSize: 13, color: "#64748b", fontWeight: 600 };
}
function infoV(): React.CSSProperties {
  return { fontSize: 14, color: "#0f172a", fontWeight: 600 };
}
function noteText(): React.CSSProperties {
  return { fontSize: 14, color: "#334155", lineHeight: 1.5 };
}
function tableScroll(): React.CSSProperties {
  return { overflowX: "auto", marginBottom: 16 };
}
function table(): React.CSSProperties {
  return { width: "100%", borderCollapse: "collapse", fontSize: 14 };
}
function th(): React.CSSProperties {
  return {
    textAlign: "left",
    padding: "10px 12px",
    borderBottom: "1px solid #e2e8f0",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
  };
}
function td(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5f9",
    color: "#334155",
    fontSize: 14,
  };
}
function tdMono(): React.CSSProperties {
  return {
    ...td(),
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 13,
  };
}
function totalsBlock(): React.CSSProperties {
  return { maxWidth: 360, marginLeft: "auto", display: "grid", gap: 8 };
}
function totalRow(): React.CSSProperties {
  return { display: "flex", justifyContent: "space-between", fontSize: 14 };
}
function totalRowStrong(): React.CSSProperties {
  return { fontSize: 16, fontWeight: 800, color: "#0f172a" };
}
function totalK(): React.CSSProperties {
  return { color: "#64748b", fontWeight: 600 };
}
function totalV(): React.CSSProperties {
  return { fontWeight: 700, color: "#0f172a" };
}
function totalDivider(): React.CSSProperties {
  return { height: 1, background: "#e2e8f0", margin: "8px 0" };
}
function sectionDesc(): React.CSSProperties {
  return { margin: "0 0 14px", fontSize: 13, color: "#64748b", lineHeight: 1.4 };
}
function sjButtonWrap(): React.CSSProperties {
  return { display: "inline-block" };
}
