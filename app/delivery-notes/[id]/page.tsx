// invoiceku/app/delivery-notes/[id]/page.tsx
// FULL REPLACE — tambah tombol Download Dotmatrix SJ (mirip PDF)

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function DeliveryNoteViewPage() {
  const supabase = supabaseBrowser();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [dn, setDn] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    setMsg("");

    const { data: dnData, error: dnErr } = await supabase
      .from("delivery_notes")
      .select("*, invoices(invoice_number, customer_name, customer_phone, customer_address)")
      .eq("id", id)
      .single();

    if (dnErr) {
      setMsg(dnErr.message);
      setLoading(false);
      return;
    }

    const { data: itemData } = await supabase
      .from("delivery_note_items")
      .select("*")
      .eq("delivery_note_id", id)
      .order("sort_order", { ascending: true });

    setDn(dnData);
    setItems(itemData || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  if (loading) return <div style={{ padding: 18 }}>Loading...</div>;
  if (msg) return <div style={{ padding: 18, color: "#b00" }}>{msg}</div>;
  if (!dn) return <div style={{ padding: 18 }}>SJ tidak ditemukan.</div>;

  return (
    <div style={{ padding: 18, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>{dn.sj_number}</h1>
          <p style={{ marginTop: 6, color: "#666" }}>
            Tanggal: {dn.sj_date} • Dari Invoice: {dn.invoices?.invoice_number}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <a href="/delivery-notes" style={btn()}>Kembali</a>

          {/* PDF */}
          <a
            href={`/api/delivery-notes/pdf/${dn.id}`}
            style={btnPrimary()}
            target="_blank"
            rel="noreferrer"
          >
            Download PDF SJ
          </a>

          {/* ✅ DOTMATRIX */}
          <a
            href={`/api/delivery-notes/pdf-dotmatrix/${dn.id}`}
            style={btn()}
            target="_blank"
            rel="noreferrer"
          >
            Download Dotmatrix SJ
          </a>

          <a href={`/invoice/${dn.invoice_id}`} style={btn()}>Buka Invoice</a>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={card()}>
          <h3 style={{ margin: 0 }}>Alamat Kirim</h3>
          <p style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
            {dn.shipping_address || dn.invoices?.customer_address || "-"}
          </p>
        </div>

        <div style={card()}>
          <h3 style={{ margin: 0 }}>Driver / Kurir</h3>
          <p style={{ marginTop: 10 }}>{dn.driver_name || "-"}</p>
          {dn.note ? (
            <p style={{ marginTop: 10, color: "#444", whiteSpace: "pre-wrap" }}>
              <b>Catatan:</b> {dn.note}
            </p>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 12, ...card() }}>
        <h3 style={{ margin: 0 }}>Items (Qty saja)</h3>
        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th()}>Nama</th>
                <th style={th()}>Qty</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td style={td()}>{it.name}</td>
                  <td style={td()}>{it.qty}</td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td style={td()} colSpan={2}>Tidak ada item.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function card(): React.CSSProperties {
  return { border: "1px solid #eee", borderRadius: 12, padding: 14, background: "white" };
}
function btn(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", textDecoration: "none", color: "#111" };
}
function btnPrimary(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "white", textDecoration: "none" };
}
function th(): React.CSSProperties {
  return { textAlign: "left", borderBottom: "1px solid #eee", padding: "8px 6px", color: "#666", fontWeight: 600 };
}
function td(): React.CSSProperties {
  return { borderBottom: "1px solid #f2f2f2", padding: "8px 6px" };
}