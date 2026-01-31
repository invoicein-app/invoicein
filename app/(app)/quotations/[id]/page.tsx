// ✅ FULL REPLACE FILE
// app/(app)/quotations/[id]/page.tsx
//
// FIX: tampilkan invoice_number (bukan UUID) di Quotation Detail
// Opsi A: fetch invoice_number langsung via Supabase client (tanpa /api/invoice/mini)

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Q = {
  id: string;
  organization_id: string | null;
  quotation_number: string | null;
  quotation_date: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  note: string | null;
  discount_type: string | null;
  discount_value: number | null;
  tax_type: string | null;
  tax_value: number | null;
  subtotal: number | null;
  total: number | null;
  status: string | null;
  invoice_id: string | null;
  is_locked: boolean | null;
};

type Item = {
  id: string;
  product_id: string | null;
  name: string | null;
  qty: number | null;
  price: number | null;
  sort_order: number | null;
};

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

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

function badgeStyle(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "accepted") return { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" };
  if (s === "sent") return { border: "1px solid #bae6fd", background: "#f0f9ff", color: "#075985" };
  if (s === "rejected") return { border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b" };
  if (s === "draft") return { border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151" };
  return { border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151" };
}

export default function QuotationDetailPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [q, setQ] = useState<Q | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [converting, setConverting] = useState(false);

  // ✅ invoice_number fetched langsung dari supabase
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [loadingInvoiceNo, setLoadingInvoiceNo] = useState(false);

  async function loadInvoiceNumber(invoiceId: string) {
    if (!invoiceId) {
      setInvoiceNumber(null);
      return;
    }

    setLoadingInvoiceNo(true);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("id,invoice_number")
        .eq("id", invoiceId)
        .maybeSingle();

      if (error) throw error;

      const no = String((data as any)?.invoice_number || "").trim();
      setInvoiceNumber(no || null);
    } catch {
      setInvoiceNumber(null);
    } finally {
      setLoadingInvoiceNo(false);
    }
  }

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        setErr("Unauthorized");
        setQ(null);
        setItems([]);
        setInvoiceNumber(null);
        return;
      }

      const { data: qRow, error: qErr } = await supabase
        .from("quotations")
        .select(
          "id,organization_id,quotation_number,quotation_date,customer_name,customer_phone,customer_address,note,discount_type,discount_value,tax_type,tax_value,subtotal,total,status,invoice_id,is_locked"
        )
        .eq("id", id)
        .maybeSingle();

      if (qErr) throw qErr;
      if (!qRow) {
        setErr("Quotation tidak ditemukan.");
        setQ(null);
        setItems([]);
        setInvoiceNumber(null);
        return;
      }

      const { data: itRows, error: itErr } = await supabase
        .from("quotation_items")
        .select("id,product_id,name,qty,price,sort_order")
        .eq("quotation_id", id)
        .order("sort_order", { ascending: true });

      if (itErr) throw itErr;

      setQ(qRow as any);
      setItems((itRows as any) || []);

      const invId = String((qRow as any)?.invoice_id || "");
      if (invId) await loadInvoiceNumber(invId);
      else setInvoiceNumber(null);
    } catch (e: any) {
      setErr(e?.message || "Gagal load quotation.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const sum = useMemo(() => items.reduce((a, it) => a + toNum(it.qty) * toNum(it.price), 0), [items]);

  const statusText = String(q?.status || "draft");
  const locked = Boolean(q?.is_locked);

  async function convertToInvoice() {
    if (!q) return;
    setConverting(true);
    try {
      if (q.invoice_id) {
        router.push(`/invoice/${q.invoice_id}`);
        return;
      }
      router.push(`/invoice/new?fromQuotationId=${q.id}`);
    } finally {
      setConverting(false);
    }
  }

  const invoiceLinkText = useMemo(() => {
    if (!q?.invoice_id) return "";
    if (loadingInvoiceNo) return "Invoice: loading...";
    if (invoiceNumber) return `Invoice: ${invoiceNumber}`;
    return `Invoice: ${String(q.invoice_id).slice(0, 8)}...`;
  }, [q?.invoice_id, invoiceNumber, loadingInvoiceNo]);

  return (
    <div style={{ padding: 6 }}>
      <div style={topbar()}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Detail Quotation</div>
          <div style={{ color: "#6b7280", marginTop: 4, fontSize: 13 }}>
            {q?.quotation_number || "-"} • {q?.quotation_date ? fmtDate(q.quotation_date) : "-"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/quotations")} style={btnSoft()} disabled={loading}>
            Kembali
          </button>

          {q?.id ? (
            <a
              href={`/api/quotations/pdf/${q.id}?download=1`}
              target="_blank"
              rel="noreferrer"
              style={btnSoftLink()}
              title="Download Quotation (PDF)"
            >
              Download
            </a>
          ) : null}

          <button onClick={convertToInvoice} style={btnPrimary()} disabled={loading || converting}>
            {converting ? "Converting..." : q?.invoice_id ? "Buka / Edit Invoice" : "Convert → Invoice"}
          </button>
        </div>
      </div>

      {err ? <div style={errBox()}>{err}</div> : null}

      <div style={grid()}>
        <div style={card()}>
          <div style={sectionTitle()}>Customer</div>
          {loading ? (
            <div>Loading...</div>
          ) : !q ? (
            <div>-</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={row()}>
                <div style={k()}>Nama</div>
                <div style={v()}>{q.customer_name || "-"}</div>
              </div>
              <div style={row()}>
                <div style={k()}>Phone</div>
                <div style={v()}>{q.customer_phone || "-"}</div>
              </div>
              <div style={row()}>
                <div style={k()}>Alamat</div>
                <div style={v()}>{q.customer_address || "-"}</div>
              </div>

              {q.note ? (
                <div style={{ marginTop: 10 }}>
                  <div style={k()}>Catatan</div>
                  <div style={{ marginTop: 6, fontWeight: 850, color: "#111827" }}>{q.note}</div>
                </div>
              ) : null}

              <div style={{ marginTop: 10 }}>
                <div style={k()}>Status</div>
                <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ ...pill(), ...badgeStyle(statusText) }}>{statusText}</span>
                  {locked ? <span style={pillSoft()}>locked</span> : null}

                  {q.invoice_id ? (
                    <Link href={`/invoice/${q.invoice_id}`} style={linkSoft()}>
                      {invoiceLinkText}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={card()}>
          <div style={sectionTitle()}>Items</div>

          <div style={tableWrap()}>
            <table style={table()}>
              <thead>
                <tr>
                  <th style={th()}>Nama</th>
                  <th style={thRight()}>Qty</th>
                  <th style={thRight()}>Harga</th>
                  <th style={thRight()}>Total</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td style={td()} colSpan={4}>
                      Loading...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td style={td()} colSpan={4}>
                      Tidak ada item.
                    </td>
                  </tr>
                ) : (
                  items.map((it) => {
                    const line = toNum(it.qty) * toNum(it.price);
                    return (
                      <tr key={it.id}>
                        <td style={td()}>{it.name || "-"}</td>
                        <td style={tdRight()}>{toNum(it.qty)}</td>
                        <td style={tdRight()}>Rp {fmtMoney(it.price)}</td>
                        <td style={tdRight()}>Rp {fmtMoney(line)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
            <div style={sumBox()}>
              <SumRow k="Subtotal" v={`Rp ${fmtMoney(q?.subtotal ?? sum)}`} />
              <SumRow k="Total" v={`Rp ${fmtMoney(q?.total)}`} strong />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SumRow({ k: kk, v: vv, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: strong ? 1000 : 900, fontSize: strong ? 16 : 13 }}>
      <div style={{ color: strong ? "#111827" : "#6b7280" }}>{kk}</div>
      <div>{vv}</div>
    </div>
  );
}

function topbar(): React.CSSProperties {
  return { display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 };
}
function grid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" };
}
function card(): React.CSSProperties {
  return { border: "1px solid #e5e7eb", background: "white", borderRadius: 14, padding: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.05)" };
}
function sectionTitle(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 950, color: "#6b7280", marginBottom: 10, letterSpacing: 0.2 };
}
function btnPrimary(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #111827", background: "#111827", color: "white", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" };
}
function btnSoft(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", color: "#111827", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" };
}
function btnSoftLink(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", color: "#111827", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none", display: "inline-flex", alignItems: "center" };
}
function errBox(): React.CSSProperties {
  return { marginBottom: 12, padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 900 };
}
function row(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "120px 1fr", gap: 10, alignItems: "start" };
}
function k(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 950, color: "#6b7280" };
}
function v(): React.CSSProperties {
  return { fontWeight: 900, color: "#111827" };
}
function pill(): React.CSSProperties {
  return { display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 950, textTransform: "lowercase" };
}
function pillSoft(): React.CSSProperties {
  return { display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 950, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", textTransform: "lowercase" };
}
function linkSoft(): React.CSSProperties {
  return { fontWeight: 900, color: "#111827", textDecoration: "underline" };
}
function tableWrap(): React.CSSProperties {
  return { width: "100%", overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12 };
}
function table(): React.CSSProperties {
  return { width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 680 };
}
function th(): React.CSSProperties {
  return { textAlign: "left", fontSize: 12, color: "#6b7280", fontWeight: 950, padding: "10px 12px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" };
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
function sumBox(): React.CSSProperties {
  return { border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#f9fafb", display: "grid", gap: 8 };
}
