"use client";

import { useEffect, useState } from "react";
import {
  formPageMutedButton,
  formPagePrimaryButton,
  formPagePrimaryButtonDisabled,
  formPageSoftLink,
} from "../components/app-action-buttons";

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

  if (state.loading) {
    return (
      <button type="button" disabled style={formPageMutedButton()}>
        Mengecek SJ...
      </button>
    );
  }

  if (state.exists) {
    return (
      <button
        type="button"
        onClick={() => (window.location.href = `/delivery-notes/${state.id}`)}
        style={formPageSoftLink()}
      >
        Lihat SJ
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={createSj}
      disabled={busy}
      style={busy ? formPagePrimaryButtonDisabled() : formPagePrimaryButton()}
    >
      {busy ? "Membuat..." : "Buat SJ"}
    </button>
  );
}
