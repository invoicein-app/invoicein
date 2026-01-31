// ✅ NEW FILE
// invoiceku/app/invoice/cancel-invoice-button-client.tsx
//
// Client button: confirm + optional reason (prompt)
// Calls POST /api/invoice/cancel
// Then refresh

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CancelInvoiceButtonClient(props: {
  invoiceId: string;
  invoiceNumber?: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onCancel() {
    if (loading) return;

    const label = props.invoiceNumber ? `Invoice ${props.invoiceNumber}` : `Invoice ${props.invoiceId.slice(0, 8)}…`;
    const ok = window.confirm(`Cancel ${label}?\n\nCatatan: setelah cancelled, invoice tetap tersimpan untuk audit.`);
    if (!ok) return;

    const reason = window.prompt("Alasan cancel (optional):", "") || "";

    setLoading(true);
    try {
      const res = await fetch("/api/invoice/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          invoice_id: props.invoiceId,
          reason: reason.trim() || null,
        }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        alert(json?.error || `Gagal cancel (${res.status})`);
        return;
      }

      // refresh page so status updates
      router.refresh();
      alert("Invoice berhasil dicancelled.");
    } catch (e: any) {
      alert(e?.message || "Gagal cancel.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={onCancel} disabled={props.disabled || loading} style={props.disabled || loading ? btnDisabled() : btnDanger()}>
      {loading ? "Cancelling..." : "Cancel"}
    </button>
  );
}

function btnDanger(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #b91c1c",
    background: "#fff1f2",
    color: "#b91c1c",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function btnDisabled(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    color: "#9ca3af",
    fontWeight: 900,
    cursor: "not-allowed",
    whiteSpace: "nowrap",
  };
}
