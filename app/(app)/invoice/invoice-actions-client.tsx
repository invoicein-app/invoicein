"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  id: string;
  invoiceNumber?: string | null;
  remaining: number;
  payStatus: string;
  hasQuotation?: boolean;
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

function todayInput() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function btnBase(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    border: "1px solid #d1d5db",
    background: "white",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
}

function btnDark(enabled: boolean): React.CSSProperties {
  return {
    ...btnBase(),
    background: enabled ? "#111" : "#9ca3af",
    color: "white",
    border: enabled ? "1px solid #111" : "1px solid #9ca3af",
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.7,
  };
}

function btnSoft(enabled: boolean): React.CSSProperties {
  return {
    ...btnBase(),
    background: enabled ? "white" : "#f3f4f6",
    color: enabled ? "#111" : "#9ca3af",
    border: enabled ? "1px solid #d1d5db" : "1px solid #e5e7eb",
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.8,
  };
}

function btnDanger(enabled: boolean): React.CSSProperties {
  return {
    ...btnBase(),
    background: enabled ? "#fff1f2" : "#f9fafb",
    color: enabled ? "#b91c1c" : "#9ca3af",
    border: enabled ? "1px solid #fca5a5" : "1px solid #e5e7eb",
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.8,
  };
}

export default function InvoiceActionsClient({
  id,
  invoiceNumber,
  remaining,
  payStatus,
  hasQuotation = false,
}: Props) {
  const router = useRouter();

  const status = String(payStatus || "").toUpperCase();

  const canPay = status === "UNPAID" || status === "PARTIAL";
  const canEdit = status === "DRAFT";
  const canCancel = status === "UNPAID" || status === "PARTIAL";
  const canDelete = status === "DRAFT" || status === "UNPAID" || status === "PARTIAL";

  const [openPay, setOpenPay] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payDate, setPayDate] = useState(todayInput());
  const [amountText, setAmountText] = useState("");
  const [payMsg, setPayMsg] = useState("");

  const [cancelling, setCancelling] = useState(false);

  const parsedAmount = useMemo(() => parseMoney(amountText), [amountText]);

  async function submitPayment() {
    setPayMsg("");

    if (!canPay) {
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

    setPaying(true);
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
        alert(`Gagal (${res.status}): ${json?.error || "Gagal tambah pembayaran."}`);
        return;
      }

      setOpenPay(false);
      setAmountText("");
      setPayMsg("");
      router.refresh();
    } catch (e: any) {
      alert(e?.message || "Gagal tambah pembayaran.");
    } finally {
      setPaying(false);
    }
  }

  async function submitCancel() {
    if (!canCancel) return;

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
        alert(`Gagal cancel (${res.status}): ${json?.error || "Gagal cancel invoice."}`);
        return;
      }

      router.refresh();
    } catch (e: any) {
      alert(e?.message || "Gagal cancel invoice.");
    } finally {
      setCancelling(false);
    }
  }

  async function submitDelete() {
    if (!canDelete) return;

    const ok = window.confirm(
      `Hapus invoice ${invoiceNumber || id}?\n\nAksi ini sebaiknya hanya untuk invoice draft / yang belum final.`
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/invoice/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        alert(`Gagal delete (${res.status}): ${json?.error || "Gagal delete invoice."}`);
        return;
      }

      router.refresh();
    } catch (e: any) {
      alert(e?.message || "Gagal delete invoice.");
    }
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexWrap: "nowrap",
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (!canPay) return;
            setPayMsg("");
            setPayDate(todayInput());
            setAmountText("");
            setOpenPay(true);
          }}
          disabled={!canPay}
          style={btnDark(canPay)}
          title={canPay ? "Tambah pembayaran" : "Invoice ini tidak bisa dibayar"}
        >
          Bayar
        </button>

        <button
          type="button"
          onClick={() => {
            if (!canEdit) return;
            window.location.href = `/invoice/edit/${id}`;
          }}
          disabled={!canEdit}
          style={btnSoft(canEdit)}
          title={canEdit ? "Edit invoice" : "Hanya invoice draft yang bisa diedit"}
        >
          Edit
        </button>

        <button
          type="button"
          onClick={submitCancel}
          disabled={!canCancel || cancelling}
          style={btnSoft(canCancel && !cancelling)}
          title={
            canCancel
              ? "Batalkan invoice"
              : "Hanya invoice sent / partial yang bisa di-cancel"
          }
        >
          {cancelling ? "Cancelling..." : "Cancel"}
        </button>

        <button
          type="button"
          onClick={submitDelete}
          disabled={!canDelete || hasQuotation}
          style={btnDanger(canDelete && !hasQuotation)}
          title={
            hasQuotation
              ? "Invoice dari quotation sebaiknya tidak dihapus"
              : canDelete
              ? "Hapus invoice"
              : "Invoice ini tidak bisa dihapus"
          }
        >
          Delete
        </button>
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
                onClick={() => {
                  if (paying) return;
                  setOpenPay(false);
                }}
                style={{
                  ...btnSoft(true),
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
                style={btnSoft(!paying)}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitPayment}
                disabled={paying}
                style={btnDark(!paying)}
              >
                {paying ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}