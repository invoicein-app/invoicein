// ✅ NEW FILE
// invoiceku/app/invoice/sent-invoice-button-client.tsx
//
// Tombol "Send Invoice"
// - call POST /api/invoice/[id]/sent
// - refresh page setelah sukses
// - disable kalau status sudah sent / paid / cancelled

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SentInvoiceButtonClient(props: {
  invoiceId: string;
  invoiceNumber?: string | null;
  currentStatus?: string | null;
}) {
  const { invoiceId, invoiceNumber, currentStatus } = props;
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const status = String(currentStatus || "").toLowerCase();
  const disabled =
    loading ||
    status === "sent" ||
    status === "paid" ||
    status === "cancelled";

  async function onSend() {
    setMsg("");

    const ok = window.confirm(
      `Kirim invoice ${invoiceNumber || ""}?\n\n` +
        `Kalau Inventory Settings = Invoice Sent, stok akan berkurang saat invoice dikirim.`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/invoice/${invoiceId}/sent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setMsg(json?.error || `Gagal send (${res.status})`);
        return;
      }

      router.refresh();
    } catch (e: any) {
      setMsg(e?.message || "Gagal send invoice.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <button
        type="button"
        onClick={onSend}
        disabled={disabled}
        style={disabled ? btnDisabled() : btnPrimary()}
        title={
          disabled
            ? "Invoice sudah tidak bisa di-send lagi"
            : "Kirim invoice"
        }
      >
        {loading ? "Sending..." : "Send Invoice"}
      </button>

      {msg ? (
        <div style={{ fontSize: 12, fontWeight: 800, color: "#b91c1c" }}>
          {msg}
        </div>
      ) : null}
    </div>
  );
}
function btnPrimary(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function btnDisabled(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#f3f4f6",
    color: "#9ca3af",
    fontWeight: 900,
    cursor: "not-allowed",
    whiteSpace: "nowrap",
  };
}
