// app/invoice/[id]/view-client.tsx  (REPLACE FULL)
"use client";

import { useMemo, useState } from "react";
import FormSubmitButton from "../../components/form-submit-button";
import { useSubmitGuard } from "../../components/use-submit-guard";

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

export default function InvoiceViewClient({ invoiceId }: { invoiceId: string }) {
  const [loading, setLoading] = useState(false);
  const [digits, setDigits] = useState("");
  const { tryBegin, end, isBlocked } = useSubmitGuard(setLoading);

  const parsed = useMemo(() => formatRpInputDigitsOnly(digits), [digits]);

  async function addPayment() {
    if (isBlocked()) return;
    if (parsed.num <= 0) {
      alert("Nominal bayar harus > 0");
      return;
    }

    if (!tryBegin()) return;
    try {
      const res = await fetch("/api/invoice/add-payment", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, amount: parsed.num }),
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

      setDigits("");
      window.location.reload();
    } catch (e: any) {
      alert(`Failed to fetch: ${e?.message || "unknown"}`);
    } finally {
      end();
    }
  }

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        border: "1px solid #eee",
        maxWidth: 520,
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 8 }}>Pembayaran (Bisa Cicil)</div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={parsed.formatted}
          onChange={(e) => setDigits(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="Rp 0"
          inputMode="numeric"
          style={{
            flex: "1 1 220px",
            minWidth: 220,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            outline: "none",
            fontWeight: 800,
          }}
        />

        <FormSubmitButton
          type="button"
          onClick={addPayment}
          busy={loading}
          busyLabel="Menyimpan..."
        >
          Tambah Pembayaran
        </FormSubmitButton>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
        Ketik angka saja, otomatis jadi format Rupiah (mis: 10000 → Rp 10.000).
      </div>
    </div>
  );
}