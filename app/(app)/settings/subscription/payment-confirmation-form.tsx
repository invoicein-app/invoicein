"use client";

import { useState } from "react";

type Props = {
  orgId: string;
  orgName: string | null;
  orgCode: string | null;
};

const card: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 20,
  background: "white",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};
const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 6 };
const input: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  fontSize: 16,
  boxSizing: "border-box",
};

export default function PaymentConfirmationForm({ orgId, orgName, orgCode }: Props) {
  const [targetPackage, setTargetPackage] = useState<"basic" | "standard">("basic");
  const [senderAccountName, setSenderAccountName] = useState("");
  const [senderBank, setSenderBank] = useState("");
  const [senderAccountNumber, setSenderAccountNumber] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/subscription/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          org_id: orgId,
          target_package: targetPackage,
          sender_account_name: senderAccountName.trim(),
          sender_bank: senderBank.trim(),
          sender_account_number: senderAccountNumber.trim(),
          transfer_amount: transferAmount.trim(),
          transfer_date: transferDate.trim(),
          note: note.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Gagal mengirim konfirmasi.");
        return;
      }
      setSuccess(true);
      setSenderAccountName("");
      setSenderBank("");
      setSenderAccountNumber("");
      setTransferAmount("");
      setTransferDate("");
      setNote("");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div style={{ ...card, marginBottom: 24, background: "#f0fdf4", borderColor: "#bbf7d0" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#166534" }}>
          Konfirmasi pembayaran telah dikirim.
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "#15803d" }}>
          Admin akan memverifikasi. Setelah transfer terverifikasi, langganan akan diperpanjang/di-upgrade. Anda bisa kirim bukti transfer ke WhatsApp admin untuk proses lebih cepat.
        </p>
        <button
          type="button"
          onClick={() => setSuccess(false)}
          style={{
            marginTop: 14,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #86efac",
            background: "white",
            color: "#166534",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Kirim konfirmasi lagi
        </button>
      </div>
    );
  }

  return (
    <div style={{ ...card, marginBottom: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
        Konfirmasi pembayaran
      </div>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
        Isi form ini setelah Anda melakukan transfer. Admin akan mengecek dan mengaktifkan perpanjangan/upgrade.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <span style={label}>Organisasi</span>
          <div style={{ padding: "10px 0", fontSize: 15, color: "#0f172a" }}>{orgName || "—"}</div>
        </div>
        <div>
          <span style={label}>Kode organisasi (org_code)</span>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 15, fontWeight: 700, letterSpacing: 1, color: "#0f172a" }}>
            {orgCode || "—"}
          </div>
        </div>

        <div>
          <label style={label}>Paket yang dipilih</label>
          <select
            value={targetPackage}
            onChange={(e) => setTargetPackage(e.target.value as "basic" | "standard")}
            style={input}
            required
          >
            <option value="basic">Bronze (Basic) — 1 staff</option>
            <option value="standard">Silver (Standard) — 3 staff</option>
          </select>
        </div>

        <div>
          <label style={label}>Nama rekening pengirim *</label>
          <input
            type="text"
            value={senderAccountName}
            onChange={(e) => setSenderAccountName(e.target.value)}
            placeholder="Nama sesuai rekening"
            style={input}
            required
          />
        </div>
        <div>
          <label style={label}>Bank pengirim *</label>
          <input
            type="text"
            value={senderBank}
            onChange={(e) => setSenderBank(e.target.value)}
            placeholder="Contoh: BCA, Mandiri"
            style={input}
            required
          />
        </div>
        <div>
          <label style={label}>Nomor rekening pengirim *</label>
          <input
            type="text"
            inputMode="numeric"
            value={senderAccountNumber}
            onChange={(e) => setSenderAccountNumber(e.target.value)}
            placeholder="Nomor rekening"
            style={input}
            required
          />
        </div>
        <div>
          <label style={label}>Nominal transfer *</label>
          <input
            type="text"
            inputMode="decimal"
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            placeholder="Contoh: 500000"
            style={input}
            required
          />
        </div>
        <div>
          <label style={label}>Tanggal transfer *</label>
          <input
            type="date"
            value={transferDate}
            onChange={(e) => setTransferDate(e.target.value)}
            style={input}
            required
          />
        </div>
        <div>
          <label style={label}>Catatan (opsional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Misalnya: perpanjang 3 bulan"
            style={{ ...input, minHeight: 80, resize: "vertical" }}
            rows={3}
          />
        </div>

        {error ? <div style={{ fontSize: 14, color: "#b91c1c" }}>{error}</div> : null}

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "14px 20px",
            borderRadius: 10,
            border: "none",
            background: "#0f172a",
            color: "white",
            fontWeight: 700,
            fontSize: 15,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Mengirim..." : "Kirim konfirmasi pembayaran"}
        </button>
      </form>
    </div>
  );
}
