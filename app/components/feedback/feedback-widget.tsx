"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";

type FeedbackCategory = "bug" | "saran" | "pertanyaan" | "keluhan";

const floatingBtnStyle: React.CSSProperties = {
  position: "fixed",
  right: 18,
  bottom: 18,
  zIndex: 70,
};

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 14px",
  borderRadius: 999,
  border: "1px solid rgba(15,23,42,0.2)",
  background: "#0f172a",
  color: "white",
  fontWeight: 900,
  fontSize: 13,
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(0,0,0,0.12)",
};

export default function FeedbackWidget() {
  const supabase = supabaseBrowser();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userLoaded, setUserLoaded] = useState(false);
  const [authed, setAuthed] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [orgCode, setOrgCode] = useState("");

  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [currentRoute, setCurrentRoute] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;
        if (!user) {
          setAuthed(false);
          setUserLoaded(true);
          return;
        }

        setAuthed(true);

        const { data: mem } = await supabase
          .from("memberships")
          .select("role, is_active, username, organizations(org_code)")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        setName(String((mem as any)?.username ?? user.email ?? "").trim());
        setEmail(String(user.email ?? "").trim());
        setOrgCode(String((mem as any)?.organizations?.org_code ?? "").trim());
        setCurrentRoute(pathname || window.location.pathname);
      } catch {
        // silent
      } finally {
        setUserLoaded(true);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const routeValue = useMemo(() => currentRoute || pathname || "/", [currentRoute, pathname]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim()) return setError("Nama wajib diisi.");
    if (!email.trim()) return setError("Email wajib diisi.");
    if (!orgCode.trim()) return setError("org_code tidak ditemukan untuk akun Anda.");
    if (!message.trim()) return setError("Pesan wajib diisi.");
    if (!routeValue.trim()) return setError("current page tidak valid.");

    setLoading(true);
    try {
      const res = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          email,
          org_code: orgCode,
          category,
          message,
          current_route: routeValue,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Gagal mengirim kritik & masukan.");
        return;
      }

      setSuccess("Terima kasih! Kritik & masukan Anda sudah terkirim.");
      setOpen(false);
      setMessage("");
      setError(null);
    } finally {
      setLoading(false);
    }
  }

  if (!userLoaded) return null;
  if (!authed) return null;

  return (
    <div style={floatingBtnStyle}>
      <button type="button" style={chipStyle} onClick={() => setOpen(true)}>
        Kritik & Masukan
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.35)",
            zIndex: 80,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "white",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 16,
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>Kritik & Masukan</div>
                <div style={{ marginTop: 6, fontSize: 13, color: "#64748b" }}>Bantu kami membuat app lebih baik.</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ padding: 8, borderRadius: 10, border: "1px solid #e5e7eb", background: "white", cursor: "pointer" }}
              >
                Tutup
              </button>
            </div>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 14 }}>
              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Nama</label>
                <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Nama Anda" />
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Email</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="email@contoh.com" inputMode="email" />
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Org code</label>
                <input value={orgCode} onChange={(e) => setOrgCode(e.target.value)} style={inputStyle} placeholder="KUC786" />
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Jenis feedback</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as FeedbackCategory)} style={inputStyle}>
                  <option value="bug">Bug</option>
                  <option value="saran">Saran</option>
                  <option value="pertanyaan">Pertanyaan</option>
                  <option value="keluhan">Keluhan</option>
                </select>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Pesan</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} style={{ ...inputStyle, minHeight: 110, resize: "vertical" }} placeholder="Tulis detail masalah / saran Anda..." />
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Halaman saat ini</label>
                <input value={routeValue} readOnly style={{ ...inputStyle, background: "#f8fafc" }} />
              </div>

              {error ? <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: 10, borderRadius: 12, fontSize: 13, fontWeight: 800 }}>{error}</div> : null}

              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: loading ? "#9ca3af" : "#0f172a",
                  color: "white",
                  fontWeight: 900,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Mengirim..." : "Kirim"}
              </button>
            </form>

            <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280", lineHeight: 1.4 }}>
              Catatan: data Anda disimpan di dalam website untuk ditinjau oleh admin.
            </div>
          </div>
        </div>
      ) : null}

      {success ? (
        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 10 }}>
          {success}
        </div>
      ) : null}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  outline: "none",
  fontSize: 14,
  color: "#111827",
  background: "white",
  boxSizing: "border-box",
};

