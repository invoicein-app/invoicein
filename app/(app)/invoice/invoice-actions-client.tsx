// ✅ FULL REPLACE
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

  // ✅ NEW: kalau invoice sudah ada quotation (invoice.quotation_id not null)
  hasQuotation?: boolean;
};

export default function InvoiceActionsClient({
  id,
  invoiceNumber,
  remaining,
  payStatus,
  hasQuotation,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const isPaid = payStatus === "PAID";
  const isLinkedQuotation = Boolean(hasQuotation); // ✅

  async function onDelete() {
    if (loading) return;

    if (isPaid) {
      alert("Invoice PAID tidak boleh delete.");
      return;
    }

    if (isLinkedQuotation) {
      alert("Invoice ini terhubung ke Quotation, jadi tidak boleh delete. Gunakan Cancel saja.");
      return;
    }

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

  // ✅ Delete disable rules:
  // - PAID => disabled
  // - linked to quotation => disabled
  const disableDelete = loading || isPaid || isLinkedQuotation;

  const deleteTitle = isPaid
    ? "Invoice PAID tidak boleh delete"
    : isLinkedQuotation
    ? "Invoice terhubung ke Quotation, tidak boleh delete"
    : "Hapus invoice";

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
        disabled={disableDelete}
        style={{
          ...btnBase,
          border: "1px solid #fecaca",
          background: disableDelete ? "#f8fafc" : "#fff5f5",
          color: disableDelete ? "#94a3b8" : "#991b1b",
          cursor: disableDelete ? "not-allowed" : "pointer",
          opacity: disableDelete ? 0.6 : 1,
        }}
        title={deleteTitle}
      >
        {loading ? "..." : "Delete"}
      </button>
    </div>
  );
}
