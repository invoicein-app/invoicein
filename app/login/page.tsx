// app/login/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function OwnerAdminLoginPage() {
  const supabase = supabaseBrowser();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const canSubmit = email.trim().length > 3 && password.length >= 6;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setMsg("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;

        setMsg("Daftar berhasil. Silakan login.");
        setMode("login");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      // init org/membership jika belum ada (pakai cookie session)
      await fetch("/api/init-org", { method: "POST" });

      window.location.href = "/dashboard";
    } catch (err: any) {
      setMsg(err?.message || "Terjadi error.");
    } finally {
      setLoading(false);
    }
  }

  const styles = {
    page: {
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: 16,
      background: "#f6f7fb",
    } as const,
    card: {
      width: 420,
      maxWidth: "100%",
      border: "1px solid #e5e7eb",
      borderRadius: 14,
      padding: 18,
      background: "white",
      boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
    } as const,
    title: { margin: 0, fontSize: 20, fontWeight: 800, color: "#111827" } as const,
    sub: { marginTop: 6, color: "#374151", fontSize: 13, lineHeight: 1.4 } as const,

    tabs: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 } as const,
    tab: (active: boolean) =>
      ({
        padding: "10px 12px",
        borderRadius: 12,
        border: active ? "1px solid #111827" : "1px solid #d1d5db",
        background: active ? "#111827" : "white",
        color: active ? "white" : "#111827",
        cursor: "pointer",
        fontWeight: 800,
        textAlign: "center",
        userSelect: "none",
      } as const),

    form: { display: "grid", gap: 10, marginTop: 12 } as const,
    input: {
      padding: 12,
      borderRadius: 12,
      border: "1px solid #d1d5db",
      outline: "none",
      fontSize: 14,
      color: "#111827",
      background: "white",
    } as const,
    help: { marginTop: 4, color: "#6b7280", fontSize: 12 } as const,

    primaryBtn: (disabled: boolean) =>
      ({
        padding: 12,
        borderRadius: 12,
        border: "1px solid #111827",
        background: disabled ? "#9ca3af" : "#111827",
        color: "white",
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 900,
      } as const),

    divider: { margin: "14px 0", borderColor: "#e5e7eb" } as const,

    staffLink: {
      display: "grid",
      textAlign: "center",
      width: "100%",
      padding: 12,
      borderRadius: 12,
      border: "1px solid #111827",
      textDecoration: "none",
      color: "#111827",
      fontWeight: 800,
      background: "#ffffff",
    } as const,

    msg: {
      marginTop: 10,
      background: "#fef2f2",
      border: "1px solid #fecaca",
      color: "#991b1b",
      padding: 10,
      borderRadius: 12,
      fontSize: 13,
    } as const,

    note: {
      marginTop: 10,
      padding: 10,
      borderRadius: 12,
      background: "#f9fafb",
      border: "1px solid #e5e7eb",
      color: "#111827",
      fontSize: 12.5,
      lineHeight: 1.45,
    } as const,
    badge: {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 999,
      background: "#111827",
      color: "white",
      fontWeight: 900,
      fontSize: 11,
      marginRight: 8,
    } as const,
    muted: { color: "#4b5563" } as const,
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>Invoicing UMKM</h2>
        <p style={styles.sub}>
          Login khusus <b>Owner/Admin</b>. Untuk staff/kasir, gunakan halaman login staff.
        </p>

        <div style={styles.tabs}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setMode("login")}
            onKeyDown={(e) => e.key === "Enter" && setMode("login")}
            style={styles.tab(mode === "login")}
            aria-label="Tab Login"
          >
            Login
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setMode("signup")}
            onKeyDown={(e) => e.key === "Enter" && setMode("signup")}
            style={styles.tab(mode === "signup")}
            aria-label="Tab Daftar"
          >
            Daftar
          </div>
        </div>

        <form onSubmit={onSubmit} style={styles.form}>
          <input
            placeholder="Email Owner/Admin"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            inputMode="email"
            autoComplete="email"
          />
          <input
            placeholder="Password (min 6 karakter)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
          <div style={styles.help}>
            {mode === "signup" ? (
              <span style={styles.muted}>Daftar hanya untuk Owner/Admin. Staff tidak daftar di sini.</span>
            ) : (
              <span style={styles.muted}>Masuk pakai email & password Owner/Admin.</span>
            )}
          </div>

          <button type="submit" disabled={loading || !canSubmit} style={styles.primaryBtn(loading || !canSubmit)}>
            {loading ? "Proses..." : mode === "login" ? "Login" : "Daftar"}
          </button>
        </form>

        {msg ? <div style={styles.msg}>{msg}</div> : null}

        <div style={styles.note}>
          <span style={styles.badge}>STAFF</span>
          <b>Staff/Kasir</b> login pakai <b>Org Code</b> + <b>Username</b> (bukan email).
        </div>

        <hr style={styles.divider} />

        <Link href="/staff/login" style={styles.staffLink}>
          Masuk sebagai Staff
        </Link>
      </div>
    </div>
  );
}