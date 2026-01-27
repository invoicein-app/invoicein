"use client";

import { useMemo, useState } from "react";

function rupiah(n: number) {
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(safe);
}

function formatRpInputDigitsOnly(rawDigits: string) {
  const digits = rawDigits.replace(/[^\d]/g, "");
  const num = digits ? parseInt(digits, 10) : 0;
  const formatted = digits ? rupiah(num) : "";
  return { digits, num, formatted };
}

export default function PayClient({
  invoiceId,
  remaining,
  onPaid,
}: {
  invoiceId: string;
  remaining: number;
  onPaid?: () => void; // optional: trigger reload (kalau kamu mau)
}) {
  const [open, setOpen] = useState(false);
  const [digits, setDigits] = useState("");
  const [loading, setLoading] = useState(false);

  const parsed = useMemo(() => formatRpInputDigitsOnly(digits), [digits]);

  const disabled = remaining <= 0;

  async function submit() {
    if (parsed.num <= 0) {
      alert("Nominal bayar harus > 0");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/invoice/add-payment", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          amount: parsed.num,
        }),
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

      alert(
        `Berhasil.\nStatus: ${json.payStatus}\nTerbayar: ${rupiah(json.paid)}\nSisa: ${rupiah(
          json.remaining
        )}`
      );

      setOpen(false);
      setDigits("");

      // refresh cepat: paling simple reload page biar angka di list update
      // (biar minim edit kamu)
      if (onPaid) onPaid();
      else window.location.reload();
    } catch (e: any) {
      alert(`Failed to fetch: ${e?.message || "unknown"}`);
    } finally {
      setLoading(false);
    }
  }

  function setQuick(val: number) {
    setDigits(String(Math.max(0, Math.floor(val))));
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        disabled={disabled}
        onClick={() => setOpen(true)}
        style={{
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: disabled ? "#f3f4f6" : "white",
          color: disabled ? "#9ca3af" : "#111",
          cursor: disabled ? "not-allowed" : "pointer",
          fontWeight: 700,
        }}
      >
        Bayar
      </button>

      {open && (
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
          onClick={() => (!loading ? setOpen(false) : null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              background: "white",
              borderRadius: 14,
              border: "1px solid #eee",
              padding: 16,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 900 }}>Tambah Pembayaran</div>
            <div style={{ marginTop: 6, color: "#666", fontSize: 13 }}>
              Sisa tagihan: <b>{rupiah(remaining)}</b>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Nominal</div>
              <input
                value={parsed.formatted}
                onChange={(e) => {
                  // kita terima apapun tapi kita extract digitnya
                  const nextDigits = e.target.value.replace(/[^\d]/g, "");
                  setDigits(nextDigits);
                }}
                placeholder="Rp 0"
                inputMode="numeric"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  outline: "none",
                  fontWeight: 800,
                }}
              />
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setQuick(Math.ceil(remaining / 2))}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => setQuick(remaining)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Lunas
                </button>
                <button
                  type="button"
                  onClick={() => setDigits("")}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "end" }}>
              <button
                disabled={loading}
                onClick={() => setOpen(false)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: 800,
                }}
              >
                Batal
              </button>
              <button
                disabled={loading}
                onClick={submit}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #111",
                  background: loading ? "#111" : "#111",
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
      )}
    </div>
  );
}