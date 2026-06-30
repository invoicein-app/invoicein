"use client";

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { createPortal } from "react-dom";
import FormSubmitButton from "../components/form-submit-button";
import { useSubmitGuard } from "../components/use-submit-guard";
import {
  formPagePrimaryLink,
  formPageSaveButton,
  formPageSoftLink,
} from "../components/app-action-buttons";
import { deliveryNoteStatusBadge, normalizeDeliveryNoteStatus } from "@/lib/delivery-note-status";

type DeliveryNoteSummary = {
  id: string;
  sj_number: string | null;
  sj_date: string | null;
  status: string | null;
};

type SjState =
  | { loading: true }
  | { loading: false; exists: false }
  | { loading: false; exists: true; deliveryNote: DeliveryNoteSummary };

type Props = {
  invoiceId: string;
  invoiceDate?: string | null;
  customerName?: string | null;
  customerAddress?: string | null;
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

function fmtDateId(iso: string | null | undefined): string {
  const s = String(iso ?? "").trim();
  if (!s) return "-";
  const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export default function SjButtonClient({
  invoiceId,
  invoiceDate,
  customerName,
  customerAddress,
}: Props) {
  const [state, setState] = useState<SjState>({ loading: true });
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sjDate, setSjDate] = useState("");
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const { tryBegin, end } = useSubmitGuard(setSaving);

  const defaultSjDate = useMemo(() => normalizeDateInput(invoiceDate), [invoiceDate]);
  const shippingAddress = String(customerAddress || "").trim() || "-";
  const shipToName = String(customerName || "").trim() || "-";
  const isCancelled =
    state.loading === false &&
    state.exists &&
    normalizeDeliveryNoteStatus(state.deliveryNote.status) === "cancelled";

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

      const dn = json?.deliveryNote;
      if (json.exists && dn?.id) {
        setState({
          loading: false,
          exists: true,
          deliveryNote: {
            id: String(dn.id),
            sj_number: dn.sj_number ?? null,
            sj_date: dn.sj_date ?? null,
            status: dn.status ?? null,
          },
        });
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
      let json: { error?: string; id?: string; deliveryNoteId?: string; already_exists?: boolean } | null = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = { error: text || "Gagal membuat Surat Jalan." };
      }

      if (!res.ok) {
        if (res.status === 409) {
          await refresh();
        }
        setErrorMsg(json?.error || `Gagal membuat Surat Jalan (${res.status}).`);
        return;
      }

      const id = json?.id || json?.deliveryNoteId;
      if (!id) {
        setErrorMsg("Surat Jalan dibuat, tapi halaman tujuan tidak ditemukan.");
        return;
      }

      if (json?.already_exists) {
        await refresh();
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

  if (state.loading) {
    return (
      <div style={panel()}>
        <div style={{ color: "#64748b", fontSize: 14, fontWeight: 600 }}>Memuat data Surat Jalan...</div>
      </div>
    );
  }

  if (state.exists) {
    const dn = state.deliveryNote;
    const badge = deliveryNoteStatusBadge(dn.status);

    return (
      <>
        <div style={panel()}>
          <div style={summaryHeader()}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", letterSpacing: "0.04em" }}>
                SURAT JALAN TERKAIT
              </div>
              <div style={{ marginTop: 4, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
                {dn.sj_number || "—"}
              </div>
            </div>
            <span
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                background: badge.bg,
                border: `1px solid ${badge.border}`,
                color: badge.color,
                whiteSpace: "nowrap",
              }}
            >
              {badge.label}
            </span>
          </div>

          <div style={infoGrid()}>
            <InfoRow label="Tanggal SJ" value={fmtDateId(dn.sj_date)} />
            <InfoRow label="Kirim ke" value={shipToName} />
            <InfoRow label="Alamat" value={shippingAddress} multiline />
          </div>

          <div style={actionRow()}>
            <button
              type="button"
              onClick={() => (window.location.href = `/delivery-notes/${dn.id}`)}
              style={formPageSoftLink()}
            >
              Lihat SJ
            </button>
            <button
              type="button"
              onClick={() => window.open(`/api/delivery-notes/pdf/${dn.id}`, "_blank", "noopener,noreferrer")}
              style={formPagePrimaryLink()}
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={() =>
                window.open(`/api/delivery-notes/pdf-dotmatrix/${dn.id}`, "_blank", "noopener,noreferrer")
              }
              style={formPageSoftLink()}
            >
              Dotmatrix
            </button>
          </div>

          {isCancelled ? (
            <p style={footnote()}>
              Surat jalan ini sudah dibatalkan. Satu invoice hanya memiliki satu SJ — buka detail untuk
              riwayat lengkap.
            </p>
          ) : (
            <p style={footnote()}>
              Item dan alamat SJ otomatis mengikuti invoice setelah Anda menyimpan perubahan invoice.
            </p>
          )}
        </div>
        {modal ? createPortal(modal, document.body) : null}
      </>
    );
  }

  return (
    <>
      <div style={panel()}>
        <div style={emptyHero()}>
          <div style={emptyIcon()} aria-hidden>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2D7D71" strokeWidth="1.75">
              <path d="M3 7h11v8H3z" strokeLinejoin="round" />
              <path d="M14 10h4l3 3v2h-7V10z" strokeLinejoin="round" />
              <circle cx="7" cy="17" r="1.5" fill="#2D7D71" stroke="none" />
              <circle cx="17" cy="17" r="1.5" fill="#2D7D71" stroke="none" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Belum ada Surat Jalan</div>
            <div style={{ marginTop: 4, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
              Buat SJ dari item invoice ini untuk dokumen pengiriman.
            </div>
          </div>
        </div>

        <ul style={bulletList()}>
          <li>Item mengikuti invoice ini</li>
          <li>Tanggal default sama dengan tanggal invoice</li>
          <li>Bisa cetak PDF setelah SJ dibuat</li>
        </ul>

        <div style={infoGrid()}>
          <InfoRow label="Kirim ke" value={shipToName} />
          <InfoRow label="Alamat kirim" value={shippingAddress} multiline />
          <InfoRow label="Tanggal rencana" value={fmtDateId(defaultSjDate)} />
        </div>

        <div style={{ marginTop: 16 }}>
          <button type="button" onClick={openModal} style={{ ...formPageSaveButton(), width: "100%" }}>
            Buat Surat Jalan
          </button>
        </div>

        <p style={footnote()}>Satu invoice = satu surat jalan.</p>
      </div>
      {modal ? createPortal(modal, document.body) : null}
    </>
  );
}

function InfoRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div style={infoRow()}>
      <span style={infoK()}>{label}</span>
      <span
        style={
          multiline
            ? { ...infoV(), whiteSpace: "pre-wrap", lineHeight: 1.45 }
            : { ...infoV(), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
        }
      >
        {value}
      </span>
    </div>
  );
}

function panel(): CSSProperties {
  return {
    minHeight: 280,
    display: "flex",
    flexDirection: "column",
    gap: 0,
  };
}

function emptyHero(): CSSProperties {
  return {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "14px 14px 12px",
    borderRadius: 12,
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
  };
}

function emptyIcon(): CSSProperties {
  return {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: "#e8f4f3",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  };
}

function bulletList(): CSSProperties {
  return {
    margin: "14px 0 0",
    paddingLeft: 20,
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 600,
  };
}

function infoGrid(): CSSProperties {
  return {
    marginTop: 14,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#fff",
  };
}

function infoRow(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "110px 1fr",
    gap: 8,
    padding: "6px 0",
    borderBottom: "1px solid #f1f5f9",
  };
}

function infoK(): CSSProperties {
  return { fontSize: 12, color: "#64748b", fontWeight: 700 };
}

function infoV(): CSSProperties {
  return { fontSize: 13, color: "#0f172a", fontWeight: 700 };
}

function summaryHeader(): CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    padding: "14px 14px 12px",
    borderRadius: 12,
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
  };
}

function actionRow(): CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  };
}

function footnote(): CSSProperties {
  return {
    marginTop: "auto",
    paddingTop: 12,
    marginBottom: 0,
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 600,
  };
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
