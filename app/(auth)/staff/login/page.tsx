// app/(auth)/staff/login/page.tsx — Staff login (UI split-screen; logic unchanged)
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { makeInternalEmail } from "@/lib/auth/internal-email";

const TEAL = "#2D7D71";
const TEAL_MINT = "#E6F4F1";
const ORANGE = "#D97706";
const BORDER = "#E2E8F0";
const TEXT = "#1e293b";
const MUTED = "#64748b";

const HERO_BG = `linear-gradient(105deg, rgba(20, 70, 62, 0.92) 0%, rgba(20, 70, 62, 0.55) 50%, rgba(20, 70, 62, 0.4) 100%), url(https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1600&q=80)`;

export default function StaffLoginPage() {
  const supabase = supabaseBrowser();

  const [orgCode, setOrgCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

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
            <div style={{ fontSize: 22, fontWeight: 900, color: TEAL, letterSpacing: "0.06em" }}>INVOICEKU</div>
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
              <LogoMark />
              <span style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>Invoiceku</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: TEXT }}>Invoicing UMKM</h1>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  color: ORANGE,
                  border: `1px solid ${ORANGE}`,
                  borderRadius: 999,
                  padding: "4px 10px",
                }}
              >
                STAFF
              </span>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: MUTED, lineHeight: 1.45 }}>
              Masuk untuk mendapatkan akses sebagai staff
            </p>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 18, marginTop: 26 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 6 }}>Org Code</label>
                <input
                  placeholder="Contoh: ABC"
                  value={orgCode}
                  onChange={(e) => setOrgCode(e.target.value)}
                  style={inputBase}
                  autoCapitalize="characters"
                  autoComplete="off"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 6 }}>Username</label>
                <input
                  placeholder="Contoh: kasir1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={inputBase}
                  autoCapitalize="none"
                  autoComplete="username"
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
                    autoComplete="current-password"
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

              {emailPreview ? (
                <div
                  style={{
                    marginTop: -4,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "#f8fafc",
                    border: `1px solid ${BORDER}`,
                    fontSize: 12,
                    lineHeight: 1.45,
                    wordBreak: "break-word",
                  }}
                >
                  <span style={{ color: MUTED, fontWeight: 700 }}>Email internal: </span>
                  <span style={{ color: TEXT, fontWeight: 800 }}>{emailPreview}</span>
                </div>
              ) : (
                <p style={{ margin: "-8px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.4 }}>
                  Isi Org Code dan Username; email internal untuk login akan tampil di sini.
                </p>
              )}

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
                {loading ? "MEMPROSES..." : "MASUK"}
              </button>
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

            <p style={{ marginTop: 18, fontSize: 12, color: MUTED, lineHeight: 1.5, textAlign: "center" }}>
              Akun staff dibuat oleh Admin melalui menu &quot;Tambah Staff&quot;.
            </p>

            <div style={{ margin: "22px 0", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: BORDER }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>atau</span>
              <div style={{ flex: 1, height: 1, background: BORDER }} />
            </div>

            <p style={{ margin: "0 0 10px", fontSize: 13, color: MUTED, textAlign: "center" }}>
              Ingin akses website sebagai Owner?
            </p>
            <Link
              href="/login"
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
              Masuk sebagai Owner
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function LogoMark() {
  return (
    <span
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: TEAL,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.8" fill="none" opacity={0.35} />
      </svg>
    </span>
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
