"use client";

import { useState } from "react";

const BANK_NAME = "BCA";
const ACCOUNT_NUMBER = "2160682399";

export default function BankInfoCard() {
  const [copied, setCopied] = useState(false);

  function copyAccount() {
    navigator.clipboard.writeText(ACCOUNT_NUMBER).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        borderRadius: 16,
        padding: 24,
        color: "white",
        border: "1px solid #334155",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 8, letterSpacing: 1 }}>
        REKENING PEMBAYARAN
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{BANK_NAME}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 20, letterSpacing: 3, fontWeight: 700 }}>
          {ACCOUNT_NUMBER}
        </span>
        <button
          type="button"
          onClick={copyAccount}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #64748b",
            background: copied ? "#22c55e" : "rgba(255,255,255,0.1)",
            color: "white",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {copied ? "Tersalin!" : "Salin"}
        </button>
      </div>
    </div>
  );
}
