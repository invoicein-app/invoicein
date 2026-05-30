"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  formPageBackLink,
  formPageDangerButton,
  formPageHeaderActions,
  formPagePrimaryButton,
  formPagePrimaryButtonDisabled,
  formPagePrimaryLink,
  formPageSoftLink,
} from "../../components/app-action-buttons";
import { APP_TEAL } from "../../components/app-ui-tokens";

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
  const customerLabel =
    String(dn.customer_name || "").trim() || dn.invoices?.customer_name || "-";
  const invoiceLabel = dn.invoice_id
    ? dn.invoices?.invoice_number || dn.invoice_id
    : "Manual (tanpa invoice)";

  return (
    <div className="app-form-page app-detail-page" style={{ width: "100%", padding: 24, boxSizing: "border-box" }}>
      <div
        className="app-form-page__header"
        style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111827" }}>{dn.sj_number}</h1>
          <p style={{ marginTop: 6, color: "#6b7280", fontSize: 14 }}>
            Tanggal: {dn.sj_date} • Customer: {customerLabel} • {dn.invoice_id ? "Invoice" : "Sumber"}:{" "}
            {invoiceLabel}
          </p>
          <div style={{ marginTop: 8 }}>
            <span style={badge(isCancelled ? "cancelled" : isPosted ? "posted" : "draft")}>
              {dnStatus}
            </span>
          </div>
        </div>

        <div className="app-form-page__header-actions" style={formPageHeaderActions()}>
          <a href="/delivery-notes" style={formPageBackLink()}>
            Kembali
          </a>

          <button
            type="button"
            onClick={handlePost}
            disabled={posting || isPosted || isCancelled}
            style={posting || isPosted || isCancelled ? formPagePrimaryButtonDisabled() : formPagePrimaryButton()}
          >
            {posting ? "Posting..." : "Post SJ"}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling || isCancelled}
            style={cancelling || isCancelled ? formPageDangerButtonDisabled() : formPageDangerButton()}
          >
            {cancelling ? "Cancelling..." : "Cancel SJ"}
          </button>

          <a
            href={`/api/delivery-notes/pdf/${dn.id}`}
            style={formPagePrimaryLink()}
            target="_blank"
            rel="noreferrer"
          >
            Download PDF SJ
          </a>

          <a
            href={`/api/delivery-notes/pdf-dotmatrix/${dn.id}`}
            style={formPageSoftLink()}
            target="_blank"
            rel="noreferrer"
          >
            Download Dotmatrix SJ
          </a>

          {dn.invoice_id ? (
            <a href={`/invoice/${dn.invoice_id}`} style={formPageSoftLink()}>
              Buka Invoice
            </a>
          ) : null}
        </div>
      </div>

      <div className="app-form-page__grid-2" style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={card()}>
          <h3 style={sectionTitle()}>Customer</h3>
          <p style={{ marginTop: 10 }}>{customerLabel}</p>
          {(dn.customer_phone || dn.invoices?.customer_phone) && (
            <p style={{ marginTop: 8, color: "#444" }}>
              <b>Telepon:</b> {dn.customer_phone || dn.invoices?.customer_phone}
            </p>
          )}
        </div>

        <div style={card()}>
          <h3 style={sectionTitle()}>Alamat Kirim</h3>
          <p style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
            {dn.shipping_address || dn.invoices?.customer_address || "-"}
          </p>
        </div>

        <div style={card()}>
          <h3 style={sectionTitle()}>Driver / Kurir</h3>
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

      <div style={{ marginTop: 14, ...card() }}>
        <h3 style={sectionTitle()}>Items</h3>
        <div className="app-form-table-scroll" style={{ marginTop: 10, overflowX: "auto" }}>
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
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 14,
    background: "white",
    boxShadow: "0 8px 24px rgba(0,0,0,0.05)",
  };
}

function sectionTitle(): React.CSSProperties {
  return { margin: 0, fontSize: 12, fontWeight: 800, color: APP_TEAL, letterSpacing: 0.2, marginBottom: 10 };
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