"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import FormSubmitButton from "../components/form-submit-button";
import { useSubmitGuard } from "../components/use-submit-guard";

export default function CancelInvoiceButtonClient(props: {
  invoiceId: string;
  invoiceNumber?: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { tryBegin, end, isBlocked } = useSubmitGuard(setLoading);

  async function onCancel() {
    if (props.disabled || isBlocked()) return;

    const label = props.invoiceNumber ? `Invoice ${props.invoiceNumber}` : `Invoice ${props.invoiceId.slice(0, 8)}…`;
    const ok = window.confirm(`Cancel ${label}?\n\nCatatan: setelah cancelled, invoice tetap tersimpan untuk audit.`);
    if (!ok) return;

    const reason = window.prompt("Alasan cancel (optional):", "") || "";

    if (!tryBegin()) return;
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

      router.refresh();
      alert("Invoice berhasil dicancelled.");
    } catch (e: any) {
      alert(e?.message || "Gagal cancel.");
    } finally {
      end();
    }
  }

  return (
    <FormSubmitButton
      type="button"
      variant="danger"
      onClick={onCancel}
      disabled={props.disabled}
      busy={loading}
      busyLabel="Membatalkan..."
    >
      Cancel
    </FormSubmitButton>
  );
}
