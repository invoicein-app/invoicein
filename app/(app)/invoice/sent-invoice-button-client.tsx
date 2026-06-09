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
import FormSubmitButton from "../components/form-submit-button";
import { useSubmitGuard } from "../components/use-submit-guard";

export default function SentInvoiceButtonClient(props: {
  invoiceId: string;
  invoiceNumber?: string | null;
  currentStatus?: string | null;
}) {
  const { invoiceId, invoiceNumber, currentStatus } = props;
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const { tryBegin, end, isBlocked } = useSubmitGuard(setLoading);

  const status = String(currentStatus || "").toLowerCase();
  const showLegacySend = status === "draft";
  const disabled = loading || !showLegacySend;

  async function onSend() {
    if (isBlocked()) return;
    setMsg("");

    const ok = window.confirm(
      `Kirim invoice ${invoiceNumber || ""}?\n\n` +
        `Kalau Inventory Settings = Invoice Sent, stok akan berkurang saat invoice dikirim.`
    );
    if (!ok) return;

    if (!tryBegin()) return;
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
      end();
    }
  }

  if (!showLegacySend) {
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <FormSubmitButton
        type="button"
        onClick={onSend}
        disabled={!showLegacySend}
        busy={loading}
        busyLabel="Mengirim..."
        title={
          disabled
            ? "Invoice sudah tidak bisa di-send lagi"
            : "Kirim invoice"
        }
      >
        Send Invoice
      </FormSubmitButton>

      {msg ? (
        <div style={{ fontSize: 12, fontWeight: 800, color: "#b91c1c" }}>
          {msg}
        </div>
      ) : null}
    </div>
  );
}
