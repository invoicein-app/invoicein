"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import FormSubmitButton from "../components/form-submit-button";
import { useSubmitGuard } from "../components/use-submit-guard";

type Props = {
  invoiceId: string;
  invoiceNumber?: string | null;
  canDelete: boolean;
  blockMessage?: string | null;
  redirectTo?: string;
  isCancelled?: boolean;
  isAdminDelete?: boolean;
};

export default function DeleteInvoiceButtonClient({
  invoiceId,
  invoiceNumber,
  canDelete,
  blockMessage,
  redirectTo = "/invoice",
  isCancelled = false,
  isAdminDelete = false,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { tryBegin, end, isBlocked } = useSubmitGuard(setLoading);

  async function onDelete() {
    if (!canDelete || isBlocked()) return;

    const label = invoiceNumber ? `Invoice ${invoiceNumber}` : `Invoice ${invoiceId.slice(0, 8)}…`;
    const confirmLines = isCancelled && isAdminDelete
      ? [
          `Hapus permanen ${label}?`,
          "",
          "Invoice ini sudah dibatalkan. Sebagai admin, hapus permanen akan menghapus jejak invoice dari sistem.",
          "Tindakan ini tidak bisa dibatalkan.",
        ]
      : [
          `Hapus permanen ${label}?`,
          "",
          "Invoice dan Surat Jalan terkait (jika ada) akan dihapus dari sistem.",
          "Stok yang sudah keluar akan dibalik otomatis bila perlu.",
          "Tindakan ini tidak bisa dibatalkan.",
        ];
    const ok = window.confirm(confirmLines.join("\n"));
    if (!ok) return;

    if (!tryBegin()) return;
    try {
      const res = await fetch(`/api/invoice/${invoiceId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json?.error || `Gagal hapus (${res.status})`);
        return;
      }

      if (redirectTo) {
        window.location.href = redirectTo;
      } else {
        router.refresh();
      }
    } catch (e: any) {
      alert(e?.message || "Gagal hapus invoice.");
    } finally {
      end();
    }
  }

  if (!canDelete) {
    if (!blockMessage) return null;
    return (
      <span
        title={blockMessage}
        style={{
          fontSize: 12,
          color: "#64748b",
          maxWidth: 220,
          lineHeight: 1.4,
          display: "inline-block",
        }}
      >
        Hapus tidak tersedia
      </span>
    );
  }

  return (
    <FormSubmitButton
      type="button"
      variant="danger"
      onClick={onDelete}
      busy={loading}
      busyLabel="Menghapus…"
      title="Hapus permanen invoice"
    >
      Hapus
    </FormSubmitButton>
  );
}
