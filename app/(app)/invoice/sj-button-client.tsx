"use client";

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { createPortal } from "react-dom";
import FormSubmitButton from "../components/form-submit-button";
import { useSubmitGuard } from "../components/use-submit-guard";
import {
  formPageMutedButton,
  formPageSaveButton,
  formPageSoftLink,
} from "../components/app-action-buttons";

type SjState =
  | { loading: true }
  | { loading: false; exists: false }
  | { loading: false; exists: true; id: string };

type Props = {
  invoiceId: string;
  invoiceDate?: string | null;
};

function normalizeDateInput(value: string | null | undefined): string {
  const s = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function SjButtonClient({ invoiceId, invoiceDate }: Props) {
  const [state, setState] = useState<SjState>({ loading: true });
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sjDate, setSjDate] = useState("");
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const { tryBegin, end } = useSubmitGuard(setSaving);

  const defaultSjDate = useMemo(() => normalizeDateInput(invoiceDate), [invoiceDate]);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function refresh() {
    setState({ loading: true });
    try {
      const res = await fetch(`/api/delivery-notes/by-invoice/${invoiceId}`, {
        method: "GET",
        credentials: "include",
      });
      const json = await res.json();

      if (!res.ok) {
        setState({ loading: false, exists: false });
        return;
      }

      if (json.exists && json.deliveryNoteId) {
        setState({ loading: false, exists: true, id: json.deliveryNoteId });
      } else {
        setState({ loading: false, exists: false });
      }
    } catch {
      setState({ loading: false, exists: false });
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  useEffect(() => {
    if (!modalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modalOpen]);

  function openModal() {
    setSjDate(defaultSjDate);
    setNote("");
    setErrorMsg("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setErrorMsg("");
  }

  async function createSj() {
    if (!sjDate.trim()) {
      setErrorMsg("Tanggal Surat Jalan wajib diisi.");
      return;
    }
    if (!tryBegin()) return;

    setErrorMsg("");

    try {
      const res = await fetch("/api/invoice/create-delivery-note", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          sj_date: sjDate,
          note: note.trim(),
        }),
      });

      const text = await res.text();
      let json: { error?: string; id?: string; deliveryNoteId?: string } | null = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = { error: text || "Gagal membuat Surat Jalan." };
      }

      if (!res.ok) {
        setErrorMsg(json?.error || `Gagal membuat Surat Jalan (${res.status}).`);
        return;
      }

      const id = json?.id || json?.deliveryNoteId;
      if (!id) {
        setErrorMsg("Surat Jalan dibuat, tapi halaman tujuan tidak ditemukan.");
        return;
      }

      setModalOpen(false);
      window.location.href = `/delivery-notes/${id}`;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal membuat Surat Jalan.";
      setErrorMsg(msg);
    } finally {
      end();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void createSj();
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

  const modal =
    modalOpen && mounted ? (
      <div
        className="app-modal-backdrop"
        style={backdrop()}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) closeModal();
        }}
      >
        <div
          className="app-modal-sheet"
          style={sheet()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sj-from-invoice-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSubmit}>
            <h3 id="sj-from-invoice-title" style={{ margin: 0 }}>
              Buat Surat Jalan
            </h3>
            <p style={{ marginTop: 8, marginBottom: 0, color: "#64748b", fontSize: 13 }}>
              Pilih tanggal Surat Jalan sebelum dokumen dibuat. Default mengikuti tanggal invoice.
            </p>

            {errorMsg ? (
              <div style={errorBox()} role="alert">
                {errorMsg}
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              <label style={label()}>
                Tanggal Surat Jalan *
                <input
                  type="date"
                  value={sjDate}
                  onChange={(e) => setSjDate(e.target.value)}
                  style={input()}
                  required
                />
              </label>

              <label style={label()}>
                Catatan (opsional)
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={{ ...input(), minHeight: 72, resize: "vertical" }}
                  placeholder="Contoh: kirim pagi, via kurir internal"
                />
              </label>
            </div>

            <div className="app-modal-sheet__actions" style={actions()}>
              <button type="button" onClick={closeModal} disabled={saving} style={cancelBtn()}>
                Batal
              </button>
              <FormSubmitButton type="submit" busy={saving} busyLabel="Membuat...">
                Simpan Surat Jalan
              </FormSubmitButton>
            </div>
          </form>
        </div>
      </div>
    ) : null;

  return (
    <>
      <button type="button" onClick={openModal} style={formPageSaveButton()}>
        Buat Surat Jalan
      </button>
      {modal ? createPortal(modal, document.body) : null}
    </>
  );
}

function backdrop(): CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    display: "grid",
    placeItems: "center",
    padding: 16,
    zIndex: 100000,
  };
}

function sheet(): CSSProperties {
  return {
    width: "100%",
    maxWidth: 420,
    background: "white",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
    border: "1px solid #e5e7eb",
  };
}

function label(): CSSProperties {
  return { display: "grid", gap: 6, fontSize: 13, fontWeight: 700, color: "#334155" };
}

function input(): CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    fontWeight: 600,
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
  };
}

function actions(): CSSProperties {
  return {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 18,
    flexWrap: "wrap",
  };
}

function cancelBtn(): CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "white",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function errorBox(): CSSProperties {
  return {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    fontSize: 13,
    fontWeight: 700,
  };
}
