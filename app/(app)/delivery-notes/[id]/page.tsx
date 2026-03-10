"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function DeliveryNoteViewPage() {
  const supabase = supabaseBrowser();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [dn, setDn] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [posting, setPosting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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

  async function handlePost() {
    if (!dn) return;
    if (String(dn.status || "draft").toLowerCase() === "posted") return;

    const ok = window.confirm(
      `Post surat jalan ${dn.sj_number || ""}?\n\nKalau setting organisasi memakai delivery_note_posted, stok akan berkurang saat ini.`
    );
    if (!ok) return;

    setPosting(true);
    try {
      const res = await fetch(`/api/delivery-notes/${dn.id}/post`, {
        method: "POST",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        alert(json?.error || `Gagal post SJ (${res.status})`);
        return;
      }

      await load();
      router.refresh();
    } catch (e: any) {
      alert(e?.message || "Gagal post SJ.");
    } finally {
      setPosting(false);
    }
  }

  async function handleCancel() {
    if (!dn) return;
    const status = String(dn.status || "draft").toLowerCase();
    if (status === "cancelled") return;

    const ok = window.confirm(
      `Batalkan surat jalan ${dn.sj_number || ""}?\n\nKalau SJ ini sudah posted dan trigger stok organisasi memakai delivery_note_posted, stok akan dikembalikan lagi.`
    );
    if (!ok) return;

    setCancelling(true);
    try {
      const res = await fetch(`/api/delivery-notes/${dn.id}/cancel`, {
        method: "POST",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        alert(json?.error || `Gagal cancel SJ (${res.status})`);
        return;
      }

      await load();
      router.refresh();
    } catch (e: any) {
      alert(e?.message || "Gagal cancel SJ.");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <div style={{ padding: 18 }}>Loading...</div>;
  if (msg) return <div style={{ padding: 18, color: "#b00" }}>{msg}</div>;
  if (!dn) return <div style={{ padding: 18 }}>SJ tidak ditemukan.</div>;

  const dnStatus = String(dn.status || "draft").toUpperCase();
  const statusLower = String(dn.status || "draft").toLowerCase();
  const isPosted = statusLower === "posted";
  const isCancelled = statusLower === "cancelled";

  return (
    <div style={{ width: "100%", padding: 24, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>{dn.sj_number}</h1>
          <p style={{ marginTop: 6, color: "#666" }}>
            Tanggal: {dn.sj_date} • Dari Invoice: {dn.invoices?.invoice_number}
          </p>
          <div style={{ marginTop: 8 }}>
            <span style={badge(isCancelled ? "cancelled" : isPosted ? "posted" : "draft")}>
              {dnStatus}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <a href="/delivery-notes" style={btn()}>Kembali</a>

          <button
            onClick={handlePost}
            disabled={posting || isPosted || isCancelled}
            style={posting || isPosted || isCancelled ? btnDisabled() : btnPrimaryBtn()}
          >
            {posting ? "Posting..." : "Post SJ"}
          </button>

          <button
            onClick={handleCancel}
            disabled={cancelling || isCancelled}
            style={cancelling || isCancelled ? btnDisabled() : btnDanger()}
          >
            {cancelling ? "Cancelling..." : "Cancel SJ"}
          </button>

          <a
            href={`/api/delivery-notes/pdf/${dn.id}`}
            style={btnPrimary()}
            target="_blank"
            rel="noreferrer"
          >
            Download PDF SJ
          </a>

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
          <p style={{ marginTop: 10, color: "#444" }}>
            <b>Gudang:</b> {dn.warehouse_id || "-"}
          </p>
          {dn.note ? (
            <p style={{ marginTop: 10, color: "#444", whiteSpace: "pre-wrap" }}>
              <b>Catatan:</b> {dn.note}
            </p>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 12, ...card() }}>
        <h3 style={{ margin: 0 }}>Items</h3>
        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th()}>Nama</th>
                <th style={th()}>Qty</th>
                <th style={th()}>Unit</th>
                <th style={th()}>Product</th>
                <th style={th()}>Key</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td style={td()}>{it.name}</td>
                  <td style={td()}>{it.qty}</td>
                  <td style={td()}>{it.unit || "-"}</td>
                  <td style={tdMono()}>{it.product_id || "-"}</td>
                  <td style={tdMono()}>{it.item_key || "-"}</td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td style={td()} colSpan={5}>Tidak ada item.</td>
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
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", textDecoration: "none", color: "#111", background: "white" };
}
function btnPrimary(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "white", textDecoration: "none" };
}
function btnPrimaryBtn(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "white", cursor: "pointer" };
}
function btnDanger(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #ef4444", background: "#fff1f2", color: "#b91c1c", cursor: "pointer" };
}
function btnDisabled(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db", background: "#f3f4f6", color: "#9ca3af", cursor: "not-allowed" };
}
function th(): React.CSSProperties {
  return { textAlign: "left", borderBottom: "1px solid #eee", padding: "8px 6px", color: "#666", fontWeight: 600 };
}
function td(): React.CSSProperties {
  return { borderBottom: "1px solid #f2f2f2", padding: "8px 6px" };
}
function tdMono(): React.CSSProperties {
  return { borderBottom: "1px solid #f2f2f2", padding: "8px 6px", fontFamily: "monospace", fontSize: 12 };
}
function badge(kind: "draft" | "posted" | "cancelled"): React.CSSProperties {
  if (kind === "posted") {
    return {
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 800,
      background: "#ecfdf5",
      border: "1px solid #6ee7b7",
      color: "#065f46",
    };
  }
  if (kind === "cancelled") {
    return {
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 800,
      background: "#fef2f2",
      border: "1px solid #fca5a5",
      color: "#991b1b",
    };
  }
  return {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: "#f3f4f6",
    border: "1px solid #d1d5db",
    color: "#374151",
  };
}