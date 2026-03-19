"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import Link from "next/link";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const params = useSearchParams();

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const type = params.get("type");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      if (!accessToken || !refreshToken) {
        setReady(false);
        return;
      }

      // Supabase recovery uses access_token + refresh_token with type=recovery.
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      setReady(true);
    }
    init().catch(() => {
      setReady(false);
    });
  }, [accessToken, refreshToken, supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setError(null);

    if (!newPassword || newPassword.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password tidak sama.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: upErr } = await supabase.auth.updateUser({ password: newPassword });
      if (upErr) {
        setError(upErr.message || "Gagal memperbarui password.");
        return;
      }

      setMsg("Password berhasil diperbarui. Anda bisa login kembali.");
      setTimeout(() => router.push("/login"), 1500);
    } finally {
      setSubmitting(false);
    }
  }

  if (!accessToken || !refreshToken) {
    return (
      <div style={{ width: 420, maxWidth: "100%" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#111827" }}>Reset Password</h2>
        <p style={{ marginTop: 6, color: "#374151", fontSize: 13, lineHeight: 1.4 }}>
          Link reset password tidak valid atau sudah kedaluwarsa. Silakan lakukan permintaan ulang.
        </p>
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <Link
            href="/forgot-password"
            style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #111827", background: "#111827", color: "white", fontWeight: 900, textDecoration: "none", textAlign: "center" }}
          >
            Minta ulang link reset
          </Link>
          <Link href="/login" style={{ color: "#111827", fontWeight: 800, fontSize: 13, textDecoration: "none", textAlign: "center" }}>
            Kembali ke login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: 420, maxWidth: "100%" }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#111827" }}>Buat Password Baru</h2>
      <p style={{ marginTop: 6, color: "#374151", fontSize: 13, lineHeight: 1.4 }}>
        Tipe recovery: <b>{type || "—"}</b>
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <input
          type="password"
          placeholder="Password baru"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
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
          autoComplete="new-password"
          required
        />
        <input
          type="password"
          placeholder="Konfirmasi password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
          autoComplete="new-password"
          required
        />

        {error ? (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
            {error}
          </div>
        ) : null}
        {msg ? (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", padding: 10, borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
            {msg}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!ready || submitting}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #111827",
            background: !ready || submitting ? "#9ca3af" : "#111827",
            color: "white",
            fontWeight: 900,
            cursor: !ready || submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Menyimpan..." : "Simpan password baru"}
        </button>
      </form>

      {!ready ? (
        <p style={{ marginTop: 10, color: "#6b7280", fontSize: 12 }}>
          Menyiapkan sesi reset password...
        </p>
      ) : null}

      <div style={{ marginTop: 12, textAlign: "center" }}>
        <Link href="/login" style={{ color: "#111827", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
          Kembali ke login
        </Link>
      </div>
    </div>
  );
}

