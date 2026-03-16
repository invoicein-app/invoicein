"use client";

import { useState } from "react";

type Org = {
  id: string;
  name: string | null;
  org_code: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  trial_ends_at: string | null;
  expires_at: string | null;
  subscription_started_at?: string | null;
};

export default function AdminBillingClient() {
  const [orgCode, setOrgCode] = useState("");
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updatePlan, setUpdatePlan] = useState("");
  const [updateExpiresAt, setUpdateExpiresAt] = useState("");

  async function search() {
    const code = orgCode.trim().toUpperCase().replace(/\s+/g, "");
    if (!code) {
      setError("Masukkan org_code.");
      return;
    }
    setError("");
    setOrg(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/billing?org_code=${encodeURIComponent(code)}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Gagal mencari.");
        return;
      }
      setOrg(json.org || null);
      if (json.org) {
        setUpdatePlan(json.org.subscription_plan || "basic");
        setUpdateExpiresAt(json.org.expires_at ? json.org.expires_at.slice(0, 10) : "");
      }
    } finally {
      setLoading(false);
    }
  }

  /** Perpanjang otomatis: dari expires_at (atau hari ini) + duration, status selalu Aktif */
  async function extendBy(months: number) {
    if (!org) return;
    setError("");
    setUpdating(true);
    try {
      const now = new Date();
      const current = org.expires_at ? new Date(org.expires_at) : null;
      const base = current && current > now ? current : now;
      const next = new Date(base);
      next.setMonth(next.getMonth() + months);

      const body = {
        org_id: org.id,
        subscription_status: "active",
        expires_at: next.toISOString().slice(0, 10),
      };
      const res = await fetch("/api/admin/billing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Gagal perpanjang.");
        return;
      }
      setOrg(json.org || null);
      if (json.org) {
        setUpdatePlan(json.org.subscription_plan || "basic");
        setUpdateExpiresAt(json.org.expires_at ? json.org.expires_at.slice(0, 10) : "");
      }
    } finally {
      setUpdating(false);
    }
  }

  async function saveUpdate() {
    if (!org) return;
    setError("");
    setUpdating(true);
    try {
      const body: Record<string, unknown> = {
        org_id: org.id,
        subscription_status: "active",
      };
      if (updatePlan) body.subscription_plan = updatePlan;
      if (updateExpiresAt) body.expires_at = updateExpiresAt || null;
      const res = await fetch("/api/admin/billing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Gagal update.");
        return;
      }
      setOrg(json.org || null);
      if (json.org) {
        setUpdatePlan(json.org.subscription_plan || "basic");
        setUpdateExpiresAt(json.org.expires_at ? json.org.expires_at.slice(0, 10) : "");
      }
    } finally {
      setUpdating(false);
    }
  }

  const card: React.CSSProperties = {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 20,
    background: "white",
    marginBottom: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  };
  const input: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    boxSizing: "border-box",
  };
  const btn: React.CSSProperties = {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  };

  return (
    <>
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>Cari organisasi</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            value={orgCode}
            onChange={(e) => setOrgCode(e.target.value)}
            placeholder="Org code (contoh: KUC786)"
            style={{ ...input, maxWidth: 220 }}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <button type="button" onClick={search} disabled={loading} style={btn}>
            {loading ? "Mencari..." : "Cari"}
          </button>
        </div>
        {error ? <div style={{ marginTop: 12, color: "#b91c1c", fontSize: 14 }}>{error}</div> : null}
      </div>

      {org && (
        <>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 14 }}>Data organisasi</div>
            <div style={{ display: "grid", gap: 10, fontSize: 14 }}>
              <div><span style={{ color: "#64748b" }}>Nama:</span> {org.name || "—"}</div>
              <div><span style={{ color: "#64748b" }}>Org code:</span> <strong style={{ fontFamily: "monospace" }}>{org.org_code || "—"}</strong></div>
              <div><span style={{ color: "#64748b" }}>Paket:</span> {org.subscription_plan || "basic"}</div>
              <div><span style={{ color: "#64748b" }}>Status:</span> {org.subscription_status || "—"}</div>
              <div><span style={{ color: "#64748b" }}>Trial berakhir:</span> {org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString("id-ID") : "—"}</div>
              <div><span style={{ color: "#64748b" }}>Aktif sampai:</span> {org.expires_at ? new Date(org.expires_at).toLocaleDateString("id-ID") : "—"}</div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>Perpanjang langganan</div>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
              Pilih lama perpanjangan. Status otomatis di-set <strong>Aktif</strong>. Dihitung dari tanggal aktif saat ini (atau hari ini jika sudah kadaluarsa).
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => extendBy(1)} disabled={updating} style={btn}>
                + 1 bulan
              </button>
              <button type="button" onClick={() => extendBy(2)} disabled={updating} style={btn}>
                + 2 bulan
              </button>
              <button type="button" onClick={() => extendBy(3)} disabled={updating} style={btn}>
                + 3 bulan
              </button>
              <button type="button" onClick={() => extendBy(6)} disabled={updating} style={btn}>
                + 6 bulan
              </button>
              <button type="button" onClick={() => extendBy(12)} disabled={updating} style={btn}>
                + 1 tahun
              </button>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 14 }}>Update langganan (manual)</div>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Paket</label>
                <select value={updatePlan} onChange={(e) => setUpdatePlan(e.target.value)} style={input}>
                  <option value="basic">Basic</option>
                  <option value="standard">Standard</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Aktif sampai (YYYY-MM-DD)</label>
                <input
                  type="date"
                  value={updateExpiresAt}
                  onChange={(e) => setUpdateExpiresAt(e.target.value)}
                  style={input}
                />
              </div>
              <button type="button" onClick={saveUpdate} disabled={updating} style={btn}>
                {updating ? "Menyimpan..." : "Simpan perubahan"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
