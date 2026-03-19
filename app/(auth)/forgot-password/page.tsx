"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setError(null);

    if (!email.trim()) {
      setError("Email wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Gagal mengirim link reset password.");
        return;
      }

      setMsg(
        "Link reset password sudah dikirim ke email Anda. Jika belum terlihat, silakan cek folder Spam atau Promosi."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ width: 420, maxWidth: "100%" }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#111827" }}>Lupa Password?</h2>
      <p style={{ marginTop: 6, color: "#374151", fontSize: 13, lineHeight: 1.4 }}>
        Masukkan email Anda untuk menerima link reset password.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <input
          placeholder="Email Anda"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #d1d5db",
            outline: "none",
            fontSize: 14,
            color: "#111827",
            background: "white",
            boxSizing: "border-box",
          }}
          inputMode="email"
          autoComplete="email"
        />

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #111827",
            background: submitting ? "#9ca3af" : "#111827",
            color: "white",
            fontWeight: 900,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Mengirim..." : "Kirim link reset"}
        </button>
      </form>

      {error ? (
        <div style={{ marginTop: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      ) : null}

      {msg ? (
        <div style={{ marginTop: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", padding: 10, borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
          {msg}
        </div>
      ) : null}

      <div style={{ marginTop: 12, textAlign: "center" }}>
        <Link href="/login" style={{ color: "#111827", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
          Kembali ke login
        </Link>
      </div>
    </div>
  );
}

