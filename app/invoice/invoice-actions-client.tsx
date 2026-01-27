// app/invoice/invoice-actions-client.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import InvoiceQuickPay from "./invoice-quick-pay";

type Props = {
  id: string;
  invoiceNumber?: string | null;
  remaining: number;
  payStatus: "UNPAID" | "PARTIAL" | "PAID";
};

export default function InvoiceActionsClient({
  id,
  invoiceNumber,
  remaining,
  payStatus,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const isPaid = payStatus === "PAID";

  async function onDelete() {
    if (loading) return;
    const ok = confirm(`Hapus invoice ${invoiceNumber || ""} ?`);
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/invoice/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json?.error || "Gagal delete");
        return;
      }

      router.refresh();
    } catch (e: any) {
      alert(e?.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }

  const btnBase: React.CSSProperties = {
    height: 36,
    padding: "0 12px",
    borderRadius: 10,
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
    textDecoration: "none",
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {/* BAYAR */}
      <InvoiceQuickPay
        invoiceId={id}
        invoiceNumber={invoiceNumber}
        remaining={remaining}
      />

      {/* EDIT */}
      <Link
        href={`/invoice/edit/${id}`}
        style={{
          ...btnBase,
          border: "1px solid #ddd",
          background: isPaid ? "#f8fafc" : "white",
          color: isPaid ? "#94a3b8" : "#111",
          pointerEvents: isPaid ? "none" : "auto",
          opacity: isPaid ? 0.6 : 1,
        }}
        title={isPaid ? "Invoice PAID (readonly)" : "Edit invoice"}
      >
        Edit
      </Link>

      {/* DELETE */}
      <button
        type="button"
        onClick={onDelete}
        disabled={loading || isPaid}
        style={{
          ...btnBase,
          border: "1px solid #fecaca",
          background: isPaid ? "#f8fafc" : "#fff5f5",
          color: isPaid ? "#94a3b8" : "#991b1b",
          cursor: loading || isPaid ? "not-allowed" : "pointer",
          opacity: loading || isPaid ? 0.6 : 1,
        }}
        title={
          isPaid ? "Invoice PAID tidak boleh delete" : "Hapus invoice"
        }
      >
        {loading ? "..." : "Delete"}
      </button>
    </div>
  );
}