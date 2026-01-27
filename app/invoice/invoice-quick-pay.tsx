"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  invoiceId: string;
  invoiceNumber?: string | null;
  remaining?: number; // boleh kamu kirim, kalau gak ada juga gapapa
};

function rupiah(n: number) {
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(safe);
}

function digitsOnly(s: string) {
  return (s || "").replace(/[^\d]/g, "");
}

function toRpInput(digits: string) {
  const num = digits ? parseInt(digits, 10) : 0;
  return digits ? rupiah(num) : "";
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function InvoiceQuickPay({ invoiceId, invoiceNumber, remaining }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [paidAt, setPaidAt] = useState(todayISO());
  const [amountDigits, setAmountDigits] = useState("");
  const amountNum = useMemo(() => (amountDigits ? parseInt(amountDigits, 10) : 0), [amountDigits]);

  const [loading, setLoading] = useState(false);

  // ✅ disable bayar kalau remaining sudah 0 (kalau remaining tidak dikirim, biarkan tetap bisa)
  const disabledPay = typeof remaining === "number" ? remaining <= 0 : false;

  function openModal() {
    // ✅ jangan buka modal kalau sudah lunas
    if (disabledPay) return;
    setPaidAt(todayISO());
    setAmountDigits("");
    setOpen(true);
  }

  function closeModal() {
    if (loading) return;
    setOpen(false);
  }

  async function submit() {
    // ✅ guard server-side behavior (biar aman walau UI di-bypass)
    if (disabledPay) return alert("Invoice sudah lunas.");
    if (!paidAt) return alert("Tanggal bayar wajib diisi.");
    if (!amountNum || amountNum <= 0) return alert("Nominal harus > 0.");

    setLoading(true);
    try {
      const res = await fetch(`/api/invoice/payments/${invoiceId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid_at: paidAt, amount: amountNum }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Gagal (${res.status}): ${json?.error || "error"}`);
        return;
      }

      setOpen(false);
      router.refresh(); // refresh list biar paid/remaining update
    } catch (e: any) {
      alert(`Failed to fetch: ${e?.message || "unknown"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={loading || disabledPay} // ✅
        title={disabledPay ? "Sudah lunas" : "Tambah pembayaran"} // ✅
        style={{
          height: 36,
          padding: "0 14px",
          borderRadius: 10,
          border: "1px solid #111",
          background: loading || disabledPay ? "#9ca3af" : "#111", // ✅
          color: "white",
          fontWeight: 900,
          cursor: loading || disabledPay ? "not-allowed" : "pointer", // ✅
          whiteSpace: "nowrap",
          opacity: loading || disabledPay ? 0.85 : 1, // ✅
        }}
      >
        Bayar
      </button>

      {open && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "grid",
            placeItems: "center",
            padding: 14,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              borderRadius: 14,
              background: "white",
              border: "1px solid #eee",
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Tambah Pembayaran</div>
                <div style={{ color: "#666", marginTop: 4, fontSize: 13 }}>
                  {invoiceNumber || "Invoice"}{" "}
                  {typeof remaining === "number" ? (
                    <>
                      • Sisa: <b>{rupiah(remaining)}</b>
                    </>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                style={{
                  height: 34,
                  padding: "0 10px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: 900,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#666" }}>Tanggal bayar</div>
                <input
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  style={{
                    width: "100%",
                    height: 42,
                    padding: "0 10px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    outline: "none",
                    fontWeight: 700,
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#666" }}>Nominal</div>
                <input
                  value={toRpInput(amountDigits)}
                  onChange={(e) => setAmountDigits(digitsOnly(e.target.value))}
                  placeholder="Rp 0"
                  inputMode="numeric"
                  style={{
                    width: "100%",
                    height: 42,
                    padding: "0 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    outline: "none",
                    fontWeight: 900,
                  }}
                />
                <div style={{ fontSize: 12, color: "#666" }}>Ketik angka saja: 10000 → Rp 10.000</div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={loading}
                  style={{
                    height: 42,
                    flex: 1,
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontWeight: 900,
                  }}
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={submit}
                  disabled={loading}
                  style={{
                    height: 42,
                    flex: 1,
                    borderRadius: 10,
                    border: "1px solid #111",
                    background: "#111",
                    color: "white",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontWeight: 900,
                  }}
                >
                  {loading ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}