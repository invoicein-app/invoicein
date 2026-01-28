// app/invoice/payments-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Payment = {
  id: string;
  invoice_id: string;
  paid_at: string; // YYYY-MM-DD
  amount: number;
  note: string | null;
  created_at: string;
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

export default function PaymentsClient({ invoiceId }: { invoiceId: string }) {
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [paidAt, setPaidAt] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [amountDigits, setAmountDigits] = useState("");
  const amountNum = useMemo(() => (amountDigits ? parseInt(amountDigits, 10) : 0), [amountDigits]);

  async function load() {
    setErr(null);
    try {
      const res = await fetch(`/api/invoice/payments/${invoiceId}`, {
        method: "GET",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Gagal load payments");
      setPayments(json.payments || []);
    } catch (e: any) {
      setErr(e?.message || "error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  async function addPayment() {
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
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Gagal tambah pembayaran");
      setAmountDigits("");
      await load();
      window.location.reload(); // refresh total Terbayar/Sisa
    } catch (e: any) {
      alert(e?.message || "error");
    } finally {
      setLoading(false);
    }
  }

  async function updatePayment(p: Payment, patch: Partial<Pick<Payment, "paid_at" | "amount">>) {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoice/payment/${p.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Gagal update pembayaran");
      await load();
      window.location.reload();
    } catch (e: any) {
      alert(e?.message || "error");
    } finally {
      setLoading(false);
    }
  }

  async function deletePayment(p: Payment) {
    if (!confirm(`Hapus pembayaran ${rupiah(Number(p.amount))} tanggal ${p.paid_at}?`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/invoice/payment/${p.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Gagal hapus pembayaran");
      await load();
      window.location.reload();
    } catch (e: any) {
      alert(e?.message || "error");
    } finally {
      setLoading(false);
    }
  }

  // ✅ wrapper cuma spacing kecil, tanpa kotak/border luar
  return (
    <div style={{ width: "100%", marginTop: 8 }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>Pembayaran (Bisa Cicil)</div>

      <div style={{ display: "grid", gap: 10 }}>
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
              fontWeight: 800,
            }}
          />
          <div style={{ fontSize: 12, color: "#666" }}>Ketik angka saja: 10000 → Rp 10.000</div>
        </div>

        <button
          type="button"
          onClick={addPayment}
          disabled={loading}
          style={{
            height: 42,
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 900,
            width: "100%",
          }}
        >
          {loading ? "Menyimpan..." : "Tambah"}
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Riwayat Pembayaran</div>

        {err && <div style={{ color: "#b91c1c", marginBottom: 8 }}>{err}</div>}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#666" }}>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee", width: 170 }}>
                  Tanggal
                </th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>Nominal</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #eee", width: 140 }}>
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody>
  {!payments.length && (
    <tr>
      <td colSpan={3} style={{ padding: 12, color: "#666" }}>
        Belum ada pembayaran.
      </td>
    </tr>
  )}

  {payments.map((p) => (
    <tr key={p.id}>
      {/* TANGGAL */}
      <td
        style={{
          padding: "10px 8px",
          borderBottom: "1px solid #f3f3f3",
          verticalAlign: "top",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <input
            type="date"
            value={p.paid_at}
            disabled={loading}
            onChange={(e) => updatePayment(p, { paid_at: e.target.value })}
            style={{
              width: "100%",
              maxWidth: 170,
              height: 36,
              padding: "0 8px",
              borderRadius: 10,
              border: "1px solid #ddd",
              fontWeight: 700,
            }}
          />
        </div>
      </td>

      {/* NOMINAL */}
      <td
        style={{
          padding: "10px 8px",
          borderBottom: "1px solid #f3f3f3",
          verticalAlign: "top",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <input
            defaultValue={rupiah(Number(p.amount))}
            disabled={loading}
            onBlur={(e) => {
              const d = digitsOnly(e.target.value);
              const n = d ? parseInt(d, 10) : 0;
              updatePayment(p, { amount: n });
              e.currentTarget.value = rupiah(n);
            }}
            placeholder="Rp 0"
            inputMode="numeric"
            style={{
              width: "100%",
              height: 36,
              padding: "0 10px",
              borderRadius: 10,
              border: "1px solid #ddd",
              fontWeight: 800,
            }}
          />

          <div style={{ fontSize: 12, color: "#666", lineHeight: 1.2 }}>
            Edit nominal → klik keluar (blur) untuk simpan.
          </div>
        </div>
      </td>

      {/* AKSI */}
      <td
        style={{
          padding: "10px 8px",
          borderBottom: "1px solid #f3f3f3",
          verticalAlign: "top",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <button
            type="button"
            onClick={() => deletePayment(p)}
            disabled={loading}
            style={{
              height: 36,
              width: "100%",
              borderRadius: 10,
              border: "1px solid #ef4444",
              background: "white",
              color: "#b91c1c",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 900,
            }}
          >
            Hapus
          </button>
        </div>
      </td>
    </tr>
  ))}
</tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
          Catatan: total “Terbayar” di invoice otomatis dihitung dari seluruh pembayaran (bisa edit/hapus kapan pun).
        </div>
      </div>
    </div>
  );
}