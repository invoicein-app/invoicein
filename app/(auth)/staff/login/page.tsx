// app/staff/login/page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { makeInternalEmail } from "@/lib/auth/internal-email";

export default function StaffLoginPage() {
  const supabase = supabaseBrowser();

  const [orgCode, setOrgCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const canSubmit =
    orgCode.trim().length >= 2 && username.trim().length >= 2 && password.length >= 6;

  const emailPreview = useMemo(() => {
    const u = username.trim();
    const o = orgCode.trim();
    if (!u && !o) return "";
    return makeInternalEmail(u, o);
  }, [username, orgCode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setMsg("");
    setLoading(true);

    try {
      const email = makeInternalEmail(username, orgCode);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      window.location.href = "/dashboard";
    } catch (err: any) {
      setMsg(err?.message || "Gagal login staff.");
    } finally {
      setLoading(false);
    }
  }

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: 16,
      background: "#F4F6FA",
    },
    card: {
      width: 420,
      maxWidth: "100%",
      background: "#fff",
      borderRadius: 16,
      padding: 18,
      border: "1px solid #E5E7EB",
      boxShadow: "0 18px 40px rgba(16,24,40,0.08)",
    },
    title: { margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" },
    sub: { marginTop: 6, marginBottom: 14, fontSize: 13, color: "#374151", lineHeight: 1.4 },

    staffHint: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: "#F9FAFB",
      border: "1px solid #E5E7EB",
      borderRadius: 12,
      padding: "10px 12px",
      marginBottom: 12,
    },
    staffBadge: {
      fontSize: 11,
      fontWeight: 900,
      color: "#111827",
      border: "1px solid #111827",
      borderRadius: 999,
      padding: "4px 10px",
      lineHeight: 1,
    },
    staffText: { fontSize: 12.5, color: "#111827", fontWeight: 700, lineHeight: 1.3 },

    form: { display: "grid", gap: 10 },
    input: {
      width: "100%",
      padding: "12px 14px",
      borderRadius: 12,
      border: "1px solid #D1D5DB",
      outline: "none",
      fontSize: 14,
      color: "#111827",
      background: "#fff",
    },
    helper: { fontSize: 12, color: "#6B7280", marginTop: 6, lineHeight: 1.35 },

    preview: {
      marginTop: 8,
      background: "#F9FAFB",
      border: "1px solid #E5E7EB",
      borderRadius: 12,
      padding: 10,
      fontSize: 12,
      lineHeight: 1.35,
      wordBreak: "break-word",
    },
    previewKey: { color: "#6B7280", fontWeight: 700 },
    previewVal: { color: "#111827", fontWeight: 900 },

    btnPrimary: {
      marginTop: 10,
      padding: "12px 14px",
      borderRadius: 12,
      border: "1px solid #111827",
      background: "#111827",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    btnPrimaryDisabled: {
      marginTop: 10,
      padding: "12px 14px",
      borderRadius: 12,
      border: "1px solid #9CA3AF",
      background: "#9CA3AF",
      color: "#fff",
      fontWeight: 900,
      cursor: "not-allowed",
    },

    msg: {
      marginTop: 12,
      background: "#FEF2F2",
      border: "1px solid #FECACA",
      color: "#991B1B",
      padding: 10,
      borderRadius: 12,
      fontSize: 13,
      fontWeight: 700,
    },

    divider: { margin: "14px 0", borderColor: "#E5E7EB" },

    link: {
      display: "block",
      width: "100%",
      textAlign: "center",
      padding: "12px 14px",
      borderRadius: 12,
      border: "1px solid #111827",
      textDecoration: "none",
      color: "#111827",
      fontWeight: 900,
      background: "#fff",
    },

    note: {
      marginTop: 10,
      fontSize: 12,
      color: "#6B7280",
      lineHeight: 1.35,
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>Invoicing UMKM</h2>
        <div style={styles.sub}>
          Login khusus <b>Staff/Kasir</b>. Untuk Owner/Admin, gunakan halaman login utama.
        </div>

        <div style={styles.staffHint}>
          <div style={styles.staffBadge}>STAFF</div>
          <div style={styles.staffText}>Login pakai Org Code + Username (bukan email).</div>
        </div>

        <form onSubmit={onSubmit} style={styles.form}>
          <input
            placeholder="Org Code (contoh: ABC)"
            value={orgCode}
            onChange={(e) => setOrgCode(e.target.value)}
            style={styles.input}
            autoCapitalize="characters"
            autoComplete="off"
          />
          <input
            placeholder="Username (contoh: kasir1)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={styles.input}
            autoCapitalize="none"
            autoComplete="username"
          />
          <input
            placeholder="Password (min 6 karakter)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            autoComplete="current-password"
          />

          {emailPreview ? (
            <div style={styles.preview}>
              <span style={styles.previewKey}>Email internal: </span>
              <span style={styles.previewVal}>{emailPreview}</span>
            </div>
          ) : (
            <div style={styles.helper}>Isi Org Code + Username, nanti email internalnya tampil.</div>
          )}

          <button
            type="submit"
            disabled={loading || !canSubmit}
            style={loading || !canSubmit ? styles.btnPrimaryDisabled : styles.btnPrimary}
          >
            {loading ? "Proses..." : "Login Staff"}
          </button>
        </form>

        {msg ? <div style={styles.msg}>{msg}</div> : null}

        <hr style={styles.divider} />

        <Link href="/login" style={styles.link}>
          Masuk sebagai Owner/Admin
        </Link>

        <div style={styles.note}>
          Catatan: Staff tidak daftar di sini. Akun staff dibuat oleh Admin lewat menu “Tambah Staff”.
        </div>
      </div>
    </div>
  );
}