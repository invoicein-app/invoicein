"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  invoiceId: string;
  initialRecorded: boolean;
};

export default function InvoiceBookkeepingToggle({ invoiceId, initialRecorded }: Props) {
  const router = useRouter();
  const [recorded, setRecorded] = useState(initialRecorded);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (loading) return;
    const next = !recorded;
    setLoading(true);
    setRecorded(next);

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/bookkeeping-recorded`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookkeeping_recorded: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRecorded(!next);
        alert(json?.error || "Gagal mengubah status pencatatan");
        return;
      }
      router.refresh();
    } catch {
      setRecorded(!next);
      alert("Gagal mengubah status pencatatan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      title={recorded ? "Sudah dicatat di buku — klik untuk batalkan" : "Belum dicatat — klik jika sudah dicatat"}
      aria-pressed={recorded}
      className={`inv-bookkeeping-toggle${recorded ? " inv-bookkeeping-toggle--on" : " inv-bookkeeping-toggle--off"}`}
      style={{
        opacity: loading ? 0.65 : 1,
        cursor: loading ? "wait" : "pointer",
      }}
    >
      {loading ? "…" : recorded ? "Sudah" : "Belum"}
    </button>
  );
}
