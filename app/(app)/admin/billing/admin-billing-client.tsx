"use client";

import { useState, useEffect } from "react";

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

type Confirmation = {
  id: string;
  org_id: string;
  target_package: string;
  sender_account_name: string;
  sender_bank: string;
  sender_account_number: string;
  transfer_amount: string;
  transfer_date: string;
  note: string | null;
  status: string;
  admin_note: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  organizations: { name: string | null; org_code: string | null } | null;
};

export default function AdminBillingClient() {
  const [orgCode, setOrgCode] = useState("");
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updatePlan, setUpdatePlan] = useState("");
  const [updateExpiresAt, setUpdateExpiresAt] = useState("");
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [confirmationsLoading, setConfirmationsLoading] = useState(true);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [subscriptionHistory, setSubscriptionHistory] = useState<
    { id: string; org_code: string; previous_plan: string | null; new_plan: string | null; previous_expires_at: string | null; new_expires_at: string | null; changed_at: string; note: string | null }[]
  >([]);
  const [subscriptionHistoryLoading, setSubscriptionHistoryLoading] = useState(false);

  async function loadConfirmations() {
    setConfirmationsLoading(true);
    try {
      const res = await fetch("/api/admin/payment-confirmations?status=all", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setConfirmations(json.confirmations || []);
    } finally {
      setConfirmationsLoading(false);
    }
  }

  const pendingConfirmations = confirmations.filter((c) => c.status === "pending");
  const processedConfirmations = confirmations.filter((c) => c.status !== "pending").slice(0, 50);

  useEffect(() => {
    loadConfirmations();
  }, []);

  async function loadSubscriptionHistory(orgId: string) {
    setSubscriptionHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/subscription-history?org_id=${encodeURIComponent(orgId)}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setSubscriptionHistory(json.history || []);
      else setSubscriptionHistory([]);
    } finally {
      setSubscriptionHistoryLoading(false);
    }
  }

  async function resolveConfirmation(id: string, status: "confirmed" | "rejected") {
    setResolvingId(id);
    try {
      const res = await fetch(`/api/admin/payment-confirmations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, admin_note: adminNotes[id] || null }),
      });
      if (res.ok) {
        setAdminNotes((prev) => ({ ...prev, [id]: "" }));
        await loadConfirmations();
      }
    } finally {
      setResolvingId(null);
    }
  }

  async function search(codeOverride?: string) {
    const code = (codeOverride ?? orgCode).trim().toUpperCase().replace(/\s+/g, "");
    if (!code) {
      setError("Masukkan org_code.");
      return;
    }
    setError("");
    setOrg(null);
    setOrgCode(code);
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
        loadSubscriptionHistory(json.org.id);
      } else {
        setSubscriptionHistory([]);
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
        loadSubscriptionHistory(json.org.id);
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
        loadSubscriptionHistory(json.org.id);
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
        <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>Konfirmasi pembayaran tertunda</div>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
          Review konfirmasi dari user. Setelah ditandai dikonfirmasi, lakukan perpanjang/update langganan di bawah (cari org_code lalu perpanjang).
        </p>
        {confirmationsLoading ? (
          <div style={{ fontSize: 14, color: "#64748b" }}>Memuat...</div>
        ) : pendingConfirmations.length === 0 ? (
          <div style={{ fontSize: 14, color: "#64748b" }}>Tidak ada konfirmasi tertunda.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {pendingConfirmations.map((c) => {
              const orgName = c.organizations?.name ?? "—";
              const orgCode = c.organizations?.org_code ?? "—";
              return (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: 16,
                    background: "#f8fafc",
                  }}
                >
                  <div style={{ display: "grid", gap: 6, fontSize: 14, marginBottom: 12 }}>
                    <div><span style={{ color: "#64748b" }}>Org:</span> <strong>{orgName}</strong> <span style={{ fontFamily: "monospace" }}>({orgCode})</span></div>
                    <div><span style={{ color: "#64748b" }}>Paket target:</span> {c.target_package === "standard" ? "Silver (Standard)" : "Bronze (Basic)"}</div>
                    <div><span style={{ color: "#64748b" }}>Pengirim:</span> {c.sender_account_name} — {c.sender_bank} {c.sender_account_number}</div>
                    <div><span style={{ color: "#64748b" }}>Nominal:</span> {c.transfer_amount} | <span style={{ color: "#64748b" }}>Tanggal:</span> {c.transfer_date}</div>
                    {c.note ? <div><span style={{ color: "#64748b" }}>Catatan:</span> {c.note}</div> : null}
                    <div style={{ fontSize: 12, color: "#64748b" }}>Dikirim: {new Date(c.created_at).toLocaleString("id-ID")}</div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <input
                      type="text"
                      placeholder="Catatan admin (opsional)"
                      value={adminNotes[c.id] ?? ""}
                      onChange={(e) => setAdminNotes((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      style={{ ...input, fontSize: 13 }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      disabled={resolvingId === c.id}
                      onClick={() => resolveConfirmation(c.id, "confirmed")}
                      style={{ ...btn, background: "#15803d", borderColor: "#15803d" }}
                    >
                      {resolvingId === c.id ? "..." : "Konfirmasi"}
                    </button>
                    <button
                      type="button"
                      disabled={resolvingId === c.id}
                      onClick={() => resolveConfirmation(c.id, "rejected")}
                      style={{ ...btn, background: "#b91c1c", borderColor: "#b91c1c" }}
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      onClick={() => search(orgCode)}
                      style={{ ...btn, background: "white", color: "#0f172a", borderColor: "#cbd5e1" }}
                    >
                      Cari org & perpanjang
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>Riwayat konfirmasi (sudah diproses)</div>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
          Konfirmasi yang sudah dikonfirmasi atau ditolak. Maks. 50 terakhir.
        </p>
        {confirmationsLoading ? (
          <div style={{ fontSize: 14, color: "#64748b" }}>Memuat...</div>
        ) : processedConfirmations.length === 0 ? (
          <div style={{ fontSize: 14, color: "#64748b" }}>Belum ada riwayat.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {processedConfirmations.map((c) => {
              const orgName = c.organizations?.name ?? "—";
              const orgCode = c.organizations?.org_code ?? "—";
              const isConfirmed = c.status === "confirmed";
              return (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: 12,
                    background: isConfirmed ? "#f0fdf4" : "#fef2f2",
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <strong>{orgName}</strong>
                    <span style={{ fontFamily: "monospace", fontSize: 13 }}>{orgCode}</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: isConfirmed ? "#15803d" : "#b91c1c",
                      }}
                    >
                      {isConfirmed ? "Dikonfirmasi" : "Ditolak"}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}>
                    Paket: {c.target_package === "standard" ? "Silver" : "Bronze"} · {c.sender_account_name} · {c.transfer_amount} · {c.transfer_date}
                  </div>
                  {c.resolved_at && (
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      Direview: {new Date(c.resolved_at).toLocaleString("id-ID")}
                    </div>
                  )}
                  {c.admin_note ? <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Catatan admin: {c.admin_note}</div> : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>Riwayat perubahan langganan</div>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>Perubahan paket atau masa aktif (maks. 20 terakhir).</p>
            {subscriptionHistoryLoading ? (
              <div style={{ fontSize: 13, color: "#64748b" }}>Memuat...</div>
            ) : subscriptionHistory.length === 0 ? (
              <div style={{ fontSize: 13, color: "#64748b" }}>Belum ada riwayat.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {subscriptionHistory.map((h) => (
                  <div key={h.id} style={{ fontSize: 13, padding: "8px 10px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                    <div style={{ color: "#64748b", marginBottom: 4 }}>
                      {new Date(h.changed_at).toLocaleString("id-ID")}
                    </div>
                    <div>
                      Paket: {h.previous_plan || "—"} → {h.new_plan || "—"}
                      {h.previous_expires_at != null || h.new_expires_at != null ? (
                        <> · Aktif sampai: {h.previous_expires_at ? new Date(h.previous_expires_at).toLocaleDateString("id-ID") : "—"} → {h.new_expires_at ? new Date(h.new_expires_at).toLocaleDateString("id-ID") : "—"}</>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
