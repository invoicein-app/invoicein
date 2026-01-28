// app/invoice/sj-button-client.tsx  (REPLACE FULL)
// versi rapi: ukuran tombol konsisten, sejajar, gak “kotak tinggi”
"use client";

import { useEffect, useState } from "react";

type SjState =
  | { loading: true }
  | { loading: false; exists: false }
  | { loading: false; exists: true; id: string };

export default function SjButtonClient({ invoiceId }: { invoiceId: string }) {
  const [state, setState] = useState<SjState>({ loading: true });
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setState({ loading: true });
    try {
      const res = await fetch(`/api/delivery-notes/by-invoice/${invoiceId}`, {
        method: "GET",
        credentials: "include",
      });
      const json = await res.json();

      if (!res.ok) {
        alert(`Gagal (${res.status}): ${json?.error || "unknown"}`);
        setState({ loading: false, exists: false });
        return;
      }

      if (json.exists && json.deliveryNoteId) {
        setState({ loading: false, exists: true, id: json.deliveryNoteId });
      } else {
        setState({ loading: false, exists: false });
      }
    } catch (e: any) {
      alert(`Failed to fetch: ${e?.message || "unknown"}`);
      setState({ loading: false, exists: false });
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  async function createSj() {
    setBusy(true);
    try {
      const res = await fetch("/api/invoice/create-delivery-note", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = { error: text };
      }

      if (!res.ok) {
        alert(`Gagal (${res.status}): ${json?.error || text}`);
        return;
      }

      const id = json?.id || json?.deliveryNoteId;
      if (!id) {
        alert(`Sukses tapi response tidak ada id: ${text}`);
        return;
      }

      window.location.href = `/delivery-notes/${id}`;
    } catch (e: any) {
      alert(`Failed to fetch: ${e?.message || "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  const baseBtn: React.CSSProperties = {
    height: 44,
    padding: "0 14px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };

  if (state.loading) {
    return (
      <button
        disabled
        style={{
          ...baseBtn,
          border: "1px solid #ddd",
          background: "#f3f4f6",
          color: "#6b7280",
          cursor: "not-allowed",
        }}
      >
        Mengecek SJ...
      </button>
    );
  }

  if (state.exists) {
    return (
      <button
        onClick={() => (window.location.href = `/delivery-notes/${state.id}`)}
        style={{
          ...baseBtn,
          border: "1px solid #111",
          background: "white",
          color: "#111",
        }}
      >
        Lihat SJ
      </button>
    );
  }

  return (
    <button
      onClick={createSj}
      disabled={busy}
      style={{
        ...baseBtn,
        border: "1px solid #0a5",
        background: busy ? "#e7fff3" : "#0a5",
        color: busy ? "#064" : "white",
        cursor: busy ? "not-allowed" : "pointer",
      }}
    >
      {busy ? "Membuat..." : "Buat SJ"}
    </button>
  );
}
