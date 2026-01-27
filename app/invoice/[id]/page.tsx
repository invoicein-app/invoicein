// invoiceku/app/invoice/[id]/page.tsx
// FULL REPLACE — versi "percent-only" (discount_value & tax_value)
// + Tambah tombol Download Dotmatrix (mirip Download PDF)

export const runtime = "nodejs";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import BackButton from "../back-button-client";
import PaymentsClient from "../payments-client";
import PdfButtonClient from "../pdf-button-client";
import SjButtonClient from "../sj-button-client";
import DotmatrixButtonClient from "../dotmatrix-button-client"; // ✅ NEW

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

  // Invoice header (percent-only: discount_value & tax_value)
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select(
      `
      id,
      invoice_number,
      invoice_date,
      status,
      customer_name,
      customer_phone,
      customer_address,
      note,
      discount_value,
      tax_value,
      amount_paid
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

  // Items
  const { data: items } = await supabase
    .from("invoice_items")
    .select("id, name, qty, price, sort_order")
    .eq("invoice_id", id)
    .order("sort_order", { ascending: true });

  const subtotal =
    (items || []).reduce(
      (acc, it: any) => acc + Number(it.qty || 0) * Number(it.price || 0),
      0
    ) || 0;

  // ✅ percent-only: ambil dari kolom discount_value & tax_value
  const discPct = clampPercent((invoice as any).discount_value);
  const taxPct = clampPercent((invoice as any).tax_value);

  const discount = Math.max(0, subtotal * (discPct / 100));
  const afterDisc = Math.max(0, subtotal - discount);
  const tax = Math.max(0, afterDisc * (taxPct / 100));
  const grandTotal = Math.max(0, afterDisc + tax);

  const amountPaid = Math.max(0, Number((invoice as any).amount_paid || 0));
  const remaining = Math.max(0, grandTotal - amountPaid);

  // Badge status (unpaid/partial/paid)
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

          {/* ✅ Download buttons */}
          <PdfButtonClient href={`/api/invoice/pdf/${id}`} />
          <DotmatrixButtonClient href={`/api/invoice/pdf-dotmatrix/${id}`} /> {/* ✅ NEW */}

          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              Invoice {(invoice as any).invoice_number || "(tanpa nomor)"}
            </div>
            <div style={{ color: "#666", marginTop: 4 }}>
              Tanggal: {(invoice as any).invoice_date || "-"} • Status dokumen:{" "}
              {(invoice as any).status || "-"}
            </div>
          </div>

          <div
            style={{
              alignSelf: "center",
              padding: "6px 10px",
              borderRadius: 999,
              background: payBg,
              border: `1px solid ${payBorder}`,
              color: payColor,
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: 0.4,
              whiteSpace: "nowrap",
              height: 32,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            {payLabel}
          </div>
        </div>
      </div>

      {/* Ringkasan pembayaran */}
      <div
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 14,
          border: "1px solid #eee",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #f1f1f1" }}>
          <div style={{ fontSize: 12, color: "#666" }}>Total Invoice</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{rupiah(grandTotal)}</div>
        </div>

        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #f1f1f1" }}>
          <div style={{ fontSize: 12, color: "#666" }}>Terbayar</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{rupiah(amountPaid)}</div>
        </div>

        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #f1f1f1" }}>
          <div style={{ fontSize: 12, color: "#666" }}>Sisa Belum Dibayar</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{rupiah(remaining)}</div>
        </div>
      </div>

      {/* Customer */}
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
        </div>
      </div>

      {/* Items */}
      <div style={{ marginTop: 16, padding: 14, borderRadius: 14, border: "1px solid #eee" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Items</div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#666" }}>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Nama</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee", width: 100 }}>
                  Qty
                </th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee", width: 160 }}>
                  Harga
                </th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee", width: 180 }}>
                  Total
                </th>
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
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f3f3" }}>
                      {Number(it.qty || 0)}
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
                  <td colSpan={4} style={{ padding: 12, color: "#666" }}>
                    Belum ada item.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary bawah */}
        <div style={{ marginTop: 12, display: "grid", gap: 6, maxWidth: 420, marginLeft: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>Subtotal</span>
            <b>{rupiah(subtotal)}</b>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>Diskon ({discPct}%)</span>
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

      {/* Note */}
      <div style={{ marginTop: 16, padding: 14, borderRadius: 14, border: "1px solid #eee" }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Catatan</div>
        <div style={{ color: "#333" }}>{(invoice as any).note || "-"}</div>
      </div>

      {/* Actions */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <SjButtonClient invoiceId={id} />

          <div style={{ flex: "1 1 740px", minWidth: 320 }}>
            <PaymentsClient invoiceId={id} />
          </div>
        </div>
      </div>
    </div>
  );
}