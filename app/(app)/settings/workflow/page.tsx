"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formPrimaryButton, tableActionSecondary } from "../../components/app-action-buttons";

const TEAL = "#1D7A73";

export default function WorkflowSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/members/preferences", { credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.ok) {
          setEnabled(Boolean(json.show_invoice_bookkeeping_status));
        } else {
          setMsg(json.error || "Gagal memuat preferensi");
        }
      } catch {
        if (alive) setMsg("Gagal memuat preferensi");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function save(next: boolean) {
    setSaving(true);
    setMsg("");
    setEnabled(next);
    try {
      const res = await fetch("/api/members/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ show_invoice_bookkeeping_status: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEnabled(!next);
        setMsg(json.error || "Gagal menyimpan");
        return;
      }
      setMsg("Preferensi disimpan.");
    } catch {
      setEnabled(!next);
      setMsg("Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  const card: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 20,
    background: "#fff",
    maxWidth: 640,
  };

  return (
    <div style={{ width: "100%", padding: "24px 20px 40px", boxSizing: "border-box" }}>
      <Link href="/settings" style={{ color: TEAL, fontWeight: 700, textDecoration: "none", fontSize: 14 }}>
        ← Kembali ke Pengaturan
      </Link>

      <h1 style={{ margin: "16px 0 6px", fontSize: 24, fontWeight: 800 }}>Alur Kerja Pribadi</h1>
      <p style={{ margin: "0 0 24px", color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
        Pengaturan opsional untuk menandai invoice yang sudah Anda catat di pembukuan di luar sistem.
        Tidak memengaruhi status pembayaran invoice.
      </p>

      {loading ? (
        <div style={{ color: "#64748b" }}>Memuat…</div>
      ) : (
        <div style={card}>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              cursor: saving ? "wait" : "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={enabled}
              disabled={saving}
              onChange={(e) => save(e.target.checked)}
              style={{ marginTop: 4, width: 18, height: 18, accentColor: TEAL }}
            />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>
                Tampilkan status pencatatan invoice
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                Jika aktif, daftar invoice menampilkan kolom <strong>Pencatatan</strong> dengan toggle
                merah (belum) / hijau (sudah). Hanya terlihat untuk akun Anda.
              </div>
            </div>
          </label>

          {msg ? (
            <p style={{ margin: "16px 0 0", fontSize: 13, color: msg.includes("Gagal") ? "#b91c1c" : "#15803d" }}>
              {msg}
            </p>
          ) : null}

          <div style={{ marginTop: 20 }}>
            <Link href="/invoice" style={enabled ? formPrimaryButton() : tableActionSecondary()}>
              Buka Daftar Invoice
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
