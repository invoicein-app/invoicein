"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FormSubmitButton from "../components/form-submit-button";
import { useSubmitGuard } from "../components/use-submit-guard";
import { toastError, toastSuccess } from "@/lib/app-toast";

type Props = {
  id: string;
  invoiceNumber?: string | null;
  remaining: number;
  payStatus: string;
  hasQuotation?: boolean;
  canDelete?: boolean;
  deleteBlockMessage?: string | null;
  isCancelled?: boolean;
  isAdminDelete?: boolean;
};

function digitsOnly(raw: string) {
  return String(raw ?? "").replace(/\D/g, "");
}

function parseMoney(raw: string) {
  const s = digitsOnly(raw);
  return s ? Number(s) : 0;
}

function formatMoneyInput(n: number) {
  const x = Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
  if (!x) return "";
  return x.toLocaleString("id-ID");
}

function defaultPayAmount(remaining: number) {
  return formatMoneyInput(Math.max(0, Math.floor(Number.isFinite(remaining) ? remaining : 0)));
}

function todayInput() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function actionRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  };
}

const TEAL = "#2D7D71";
const TEAL_SOFT = "#e8f4f3";

function btnPrimary(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.06em",
    border: `1px solid ${TEAL}`,
    background: TEAL,
    color: "white",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
}

function btnSecondary(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    border: `1px solid ${TEAL}`,
    background: TEAL_SOFT,
    color: TEAL,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
}

function btnSecondaryDisabled(): React.CSSProperties {
  return {
    ...btnSecondary(),
    cursor: "not-allowed",
    opacity: 0.7,
  };
}

function btnDanger(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid #ffcdd2",
    background: "#fff5f5",
    color: "#c62828",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
}

function btnSoft(disabled?: boolean): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    border: "1px solid #e2e8f0",
    background: disabled ? "#f1f5f9" : "white",
    color: "#334155",
    cursor: disabled ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
  };
}

function btnDark(disabled?: boolean): React.CSSProperties {
  return {
    ...btnSoft(disabled),
    border: "1px solid #0f172a",
    background: disabled ? "#94a3b8" : "#0f172a",
    color: "white",
  };
}

export default function InvoiceActionsClient({
  id,
  invoiceNumber,
  remaining,
  payStatus,
  hasQuotation = false,
  canDelete = false,
  deleteBlockMessage = null,
  isCancelled = false,
  isAdminDelete = false,
}: Props) {
  const router = useRouter();

  const status = String(payStatus || "").toUpperCase();

  // Visibility: only show actions that are relevant for this status. Do not show disabled buttons.
  const showBayar = status === "UNPAID" || status === "PARTIAL";
  const showCancel = status === "UNPAID" || status === "PARTIAL";
  const showEdit = status !== "CANCELLED";
  const showDelete = canDelete;

  const [openPay, setOpenPay] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payDate, setPayDate] = useState(todayInput());
  const [amountText, setAmountText] = useState("");
  const [payMsg, setPayMsg] = useState("");

  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const payGuard = useSubmitGuard(setPaying);
  const deleteGuard = useSubmitGuard(setDeleting);

  const parsedAmount = useMemo(() => parseMoney(amountText), [amountText]);

  async function submitPayment() {
    if (payGuard.isBlocked()) return;
    setPayMsg("");

    if (!showBayar) {
      setPayMsg("Invoice ini tidak bisa menerima pembayaran.");
      return;
    }

    if (!payDate) {
      setPayMsg("Tanggal bayar wajib diisi.");
      return;
    }

    if (!parsedAmount || parsedAmount <= 0) {
      setPayMsg("Nominal harus lebih dari 0.");
      return;
    }

    if (!payGuard.tryBegin()) return;
    try {
      const res = await fetch(`/api/invoice/payments/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          paid_at: payDate,
          amount: parsedAmount,
          note: "",
        }),
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        toastError(json?.error || `Gagal mencatat pembayaran (${res.status})`);
        return;
      }

      setOpenPay(false);
      setAmountText("");
      setPayMsg("");
      toastSuccess("Pembayaran berhasil dicatat.");
      router.refresh();
    } catch (e: any) {
      toastError(e?.message || "Gagal mencatat pembayaran.");
    } finally {
      payGuard.end();
    }
  }

  async function submitCancel() {
    if (!showCancel) return;

    const ok = window.confirm(
      `Batalkan invoice ${invoiceNumber || id}?\n\nKalau invoice ini pernah mengurangi stok, stok akan dikembalikan lagi.`
    );
    if (!ok) return;

    setCancelling(true);
    try {
      const res = await fetch("/api/invoice/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          invoice_id: id,
        }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        toastError(json?.error || `Gagal membatalkan invoice (${res.status})`);
        return;
      }

      toastSuccess("Invoice berhasil dibatalkan.");
      router.refresh();
    } catch (e: any) {
      toastError(e?.message || "Gagal membatalkan invoice.");
    } finally {
      setCancelling(false);
    }
  }

  async function submitDelete() {
    if (!showDelete) return;
    if (deleteGuard.isBlocked()) return;

    const confirmLines = isCancelled && isAdminDelete
      ? [
          `Hapus permanen invoice ${invoiceNumber || id}?`,
          "",
          "Invoice ini sudah dibatalkan. Sebagai admin, hapus permanen akan menghapus jejak invoice dari sistem.",
          "Tindakan ini tidak bisa dibatalkan.",
        ]
      : [
          `Hapus permanen invoice ${invoiceNumber || id}?`,
          "",
          "Data invoice akan dihapus dari sistem. Tindakan ini tidak bisa dibatalkan.",
        ];
    const ok = window.confirm(confirmLines.join("\n"));
    if (!ok) return;

    if (!deleteGuard.tryBegin()) return;
    try {
      const res = await fetch(`/api/invoice/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        toastError(json?.error || `Gagal menghapus invoice (${res.status})`);
        return;
      }

      toastSuccess("Invoice berhasil dihapus.");
      window.location.href = "/invoice";
    } catch (e: any) {
      toastError(e?.message || "Gagal menghapus invoice.");
    } finally {
      deleteGuard.end();
    }
  }

  return (
    <>
      <div style={actionRow()}>
        {showBayar && (
          <button
            type="button"
            onClick={() => {
              setPayMsg("");
              setPayDate(todayInput());
              setAmountText(defaultPayAmount(remaining));
              setOpenPay(true);
            }}
            style={btnPrimary()}
            title="Tambah pembayaran"
          >
            BAYAR
          </button>
        )}

        {showEdit && (
          <button
            type="button"
            onClick={() => {
              window.location.href = `/invoice/edit/${id}`;
            }}
            style={{
              ...btnSecondary(),
              background: "#fff",
            }}
            title="Ubah invoice"
          >
            Ubah
          </button>
        )}

        {showCancel && (
          <button
            type="button"
            onClick={submitCancel}
            disabled={cancelling}
            style={cancelling ? btnSecondaryDisabled() : btnSecondary()}
            title="Batalkan invoice"
          >
            {cancelling ? "..." : "Cancel"}
          </button>
        )}

        {showDelete && (
          <FormSubmitButton
            type="button"
            variant="danger"
            onClick={submitDelete}
            busy={deleting}
            busyLabel="Menghapus…"
            style={btnDanger()}
            title="Hapus permanen invoice"
          >
            Hapus
          </FormSubmitButton>
        )}

        {!showDelete && deleteBlockMessage && !isCancelled ? (
          <span
            title={deleteBlockMessage}
            style={{ fontSize: 11, color: "#94a3b8", maxWidth: 140, lineHeight: 1.3 }}
          >
            Hapus tidak tersedia
          </span>
        ) : null}
      </div>

      {openPay ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 560,
              background: "white",
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900 }}>Tambah Pembayaran</div>
                <div style={{ marginTop: 6, color: "#666", fontSize: 14 }}>
                  {invoiceNumber || id} • Sisa: Rp {Math.max(0, Math.floor(remaining)).toLocaleString("id-ID")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenPay(false)}
                disabled={paying}
                aria-label="Tutup"
                style={{
                  ...btnSoft(paying),
                  width: 36,
                  height: 36,
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>

            {payMsg ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#991b1b",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {payMsg}
              </div>
            ) : null}

            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6, fontWeight: 700, color: "#444" }}>
                Tanggal bayar
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #d1d5db",
                    outline: "none",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 6, fontWeight: 700, color: "#444" }}>
                Nominal
                <input
                  value={amountText}
                  onChange={(e) => setAmountText(formatMoneyInput(parseMoney(e.target.value)))}
                  inputMode="numeric"
                  placeholder="contoh: 50.000"
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #d1d5db",
                    outline: "none",
                  }}
                />
                <div style={{ fontSize: 12, color: "#666" }}>
                  Ketik angka saja: 10000 → Rp 10.000
                </div>
              </label>
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setOpenPay(false)}
                disabled={paying}
                style={btnSoft(paying)}
              >
                Batal
              </button>
              <FormSubmitButton
                type="button"
                onClick={submitPayment}
                busy={paying}
                style={btnDark(paying)}
              >
                Simpan
              </FormSubmitButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}