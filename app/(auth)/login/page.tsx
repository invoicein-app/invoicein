// app/(auth)/login/page.tsx — Owner/Admin login + daftar (UI split-screen; logic unchanged)
"use client";

import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import AppLogo from "@/app/components/app-logo";

const TEAL = "#2D7D71";
const TEAL_MINT = "#E6F4F1";
const BORDER = "#E2E8F0";
const TEXT = "#1e293b";
const MUTED = "#64748b";

const HERO_BG = `linear-gradient(105deg, rgba(20, 70, 62, 0.92) 0%, rgba(20, 70, 62, 0.55) 50%, rgba(20, 70, 62, 0.4) 100%), url(https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1600&q=80)`;

export default function OwnerAdminLoginPage() {
  const supabase = supabaseBrowser();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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

      await fetch("/api/init-org", { method: "POST" });

      window.location.href = "/dashboard";
    } catch (err: any) {
      setMsg(err?.message || "Terjadi error.");
    } finally {
      setLoading(false);
    }
  }

  const inputBase: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    outline: "none",
    fontSize: 14,
    color: TEXT,
    background: "#fff",
    boxSizing: "border-box",
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .auth-split-root { display: flex; min-height: 100vh; width: 100%; flex-direction: row; }
        .auth-split-left { flex: 1 1 50%; min-width: 0; position: relative; }
        .auth-split-right { flex: 1 1 50%; min-width: 0; display: flex; align-items: center; justify-content: center; padding: 32px 24px; background: #f1f5f4; box-sizing: border-box; }
        @media (max-width: 900px) {
          .auth-split-root { flex-direction: column; }
          .auth-split-left { flex: 0 0 auto; min-height: 200px; width: 100%; }
          .auth-split-right { flex: 1 1 auto; width: 100%; padding: 20px 16px 32px; }
        }
      `}} />

      <div className="auth-split-root">
        <div
          className="auth-split-left"
          style={{
            backgroundImage: HERO_BG,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 32,
              left: 32,
              right: 32,
              maxWidth: 420,
              padding: "22px 24px",
              borderRadius: 24,
              background: "rgba(255,255,255,0.92)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              boxSizing: "border-box",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 900, color: TEAL, letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 10 }}>
              <AppLogo size={32} />
              INVOICEKU
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.55, color: MUTED, fontWeight: 500 }}>
              Kelola stok, invoice, purchase order, surat jalan, dan pembayaran tanpa pusing — lebih cepat, rapi,
              dan minim kesalahan.
            </p>
          </div>
        </div>

        <div className="auth-split-right">
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#fff",
              borderRadius: 28,
              padding: "40px 40px 36px",
              boxShadow: "0 24px 48px rgba(15, 60, 55, 0.12)",
              border: `1px solid ${BORDER}`,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
              <AppLogo size={36} />
              <span style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>Invoiceku</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: TEXT }}>Invoicing UMKM</h1>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  color: TEAL,
                  border: `1px solid ${TEAL}`,
                  borderRadius: 999,
                  padding: "4px 10px",
                }}
              >
                OWNER
              </span>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: MUTED, lineHeight: 1.45 }}>
              {mode === "login"
                ? "Masuk untuk mendapatkan akses sebagai owner"
                : "Daftar akun owner/admin untuk mulai menggunakan InvoiceKU"}
            </p>

            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setMode("login")}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: mode === "login" ? `2px solid ${TEAL}` : `1px solid ${BORDER}`,
                  background: mode === "login" ? TEAL_MINT : "#fff",
                  color: mode === "login" ? TEAL : MUTED,
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: mode === "signup" ? `2px solid ${TEAL}` : `1px solid ${BORDER}`,
                  background: mode === "signup" ? TEAL_MINT : "#fff",
                  color: mode === "signup" ? TEAL : MUTED,
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Daftar
              </button>
            </div>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 18, marginTop: 22 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 6 }}>Email</label>
                <input
                  placeholder="mail@mail.co.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputBase}
                  inputMode="email"
                  autoComplete="email"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 6 }}>Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    placeholder="••••••••"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ ...inputBase, paddingRight: 48 }}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    onClick={() => setShowPassword((s) => !s)}
                    style={{
                      position: "absolute",
                      right: 4,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 40,
                      height: 36,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 6,
                      color: TEAL,
                    }}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.4 }}>
                {mode === "signup"
                  ? "Daftar hanya untuk Owner/Admin. Staff tidak mendaftar di halaman ini."
                  : "Masuk menggunakan email dan password akun Owner/Admin."}
              </p>

              <button
                type="submit"
                disabled={loading || !canSubmit}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: loading || !canSubmit ? "#94a3b8" : TEAL,
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 15,
                  letterSpacing: "0.06em",
                  cursor: loading || !canSubmit ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "MEMPROSES..." : mode === "login" ? "MASUK" : "DAFTAR"}
              </button>

              {mode === "login" ? (
                <div style={{ textAlign: "center", marginTop: -6 }}>
                  <Link href="/forgot-password" style={{ fontSize: 13, fontWeight: 700, color: TEAL, textDecoration: "none" }}>
                    Lupa password?
                  </Link>
                </div>
              ) : null}
            </form>

            {msg ? (
              <div
                style={{
                  marginTop: 16,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  padding: 12,
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {msg}
              </div>
            ) : null}

            {mode === "login" ? (
              <p style={{ marginTop: 20, textAlign: "center", fontSize: 14, color: MUTED }}>
                Belum memiliki akun aktif?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  style={{ background: "none", border: "none", padding: 0, color: TEAL, fontWeight: 800, cursor: "pointer", fontSize: 14 }}
                >
                  Daftar sekarang
                </button>
              </p>
            ) : (
              <p style={{ marginTop: 20, textAlign: "center", fontSize: 14, color: MUTED }}>
                Sudah punya akun?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  style={{ background: "none", border: "none", padding: 0, color: TEAL, fontWeight: 800, cursor: "pointer", fontSize: 14 }}
                >
                  Masuk
                </button>
              </p>
            )}

            <div style={{ margin: "22px 0", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: BORDER }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>atau</span>
              <div style={{ flex: 1, height: 1, background: BORDER }} />
            </div>

            <p style={{ margin: "0 0 10px", fontSize: 13, color: MUTED, textAlign: "center" }}>
              Ingin akses website sebagai staff?
            </p>
            <Link
              href="/staff/login"
              style={{
                display: "block",
                width: "100%",
                textAlign: "center",
                padding: "14px 16px",
                borderRadius: 8,
                border: `1px solid ${TEAL}`,
                background: TEAL_MINT,
                color: TEAL,
                fontWeight: 800,
                fontSize: 14,
                textDecoration: "none",
                boxSizing: "border-box",
              }}
            >
              Masuk sebagai Staff
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.88 9.88A3 3 0 0112 5c4 0 7 4 7 4s-1.27 2.11-3.19 3.39"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M6.53 6.53A9.77 9.77 0 005 9s3 4 7 4a6.9 6.9 0 002.41-.45M12 17c-4 0-7-4-7-4a12.77 12.77 0 012.09-2.63"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M1 12s4-6 11-6 11 6 11 6-4 6-11 6S1 12 1 12z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}
