"use client";

import { useEffect, useMemo, useState } from "react";

type FeedbackCategory = "bug" | "saran" | "pertanyaan" | "keluhan";
type FeedbackStatus = "new" | "read" | "processed" | "done";

type FeedbackItem = {
  id: string;
  org_code: string;
  user_id: string | null;
  name: string;
  email: string;
  category: FeedbackCategory;
  message: string;
  current_route: string;
  status: FeedbackStatus;
  admin_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 14,
  background: "white",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

function statusLabel(status: FeedbackStatus) {
  if (status === "new") return "Baru";
  if (status === "read") return "Dibaca";
  if (status === "processed") return "Diproses";
  return "Selesai";
}

function statusColor(status: FeedbackStatus) {
  if (status === "new") return { bg: "#f8fafc", color: "#334155" };
  if (status === "read") return { bg: "#eff6ff", color: "#1d4ed8" };
  if (status === "processed") return { bg: "#fef3c7", color: "#92400e" };
  return { bg: "#f0fdf4", color: "#166534" };
}

export default function AdminFeedbackClient() {
  const [statusFilter, setStatusFilter] = useState<"new" | "all">("new");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(() => items.find((it) => it.id === selectedId) || null, [items, selectedId]);

  const [adminNoteDraft, setAdminNoteDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<FeedbackStatus>("read");

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const url = statusFilter === "all" ? "/api/admin/feedback?status=all" : `/api/admin/feedback?status=${statusFilter}`;
        const res = await fetch(url, { credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Gagal memuat feedback.");
        setItems(json.feedback || []);
      } catch (e: any) {
        setError(e?.message || "Gagal memuat feedback.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [statusFilter]);

  useEffect(() => {
    if (!selected) return;
    setAdminNoteDraft(selected.admin_note || "");
    setStatusDraft(selected.status === "new" ? "read" : selected.status);
  }, [selected]);

  async function save() {
    if (!selected) return;
    setSaving(true);
    setToast(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/feedback/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: statusDraft,
          admin_note: adminNoteDraft || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Gagal menyimpan.");

      // update local item
      setItems((prev) =>
        prev.map((it) =>
          it.id === selected.id
            ? {
                ...it,
                status: statusDraft,
                admin_note: adminNoteDraft || null,
              }
            : it
        )
      );
      setToast("Perubahan status berhasil disimpan.");
    } catch (e: any) {
      setError(e?.message || "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  const options: Array<{ value: FeedbackStatus; label: string }> = [
    { value: "new", label: "Baru" },
    { value: "read", label: "Dibaca" },
    { value: "processed", label: "Diproses" },
    { value: "done", label: "Selesai" },
  ];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ ...cardStyle, background: "#f8fafc" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>Filter</div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "white",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            <option value="new">Pending (Baru)</option>
            <option value="all">Semua</option>
          </select>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "white",
              color: "#0f172a",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Reset pilihan
          </button>
        </div>
        <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
          Tinjau feedback pengguna dan perbarui status sesuai kebutuhan.
        </div>
      </div>

      {error ? <div style={{ ...cardStyle, background: "#FEF2F2", borderColor: "#FECACA", color: "#991b1b", fontWeight: 800 }}>{error}</div> : null}

      {loading ? <div style={{ color: "#64748b" }}>Memuat...</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>Daftar feedback</div>
          {items.length === 0 ? (
            <div style={{ color: "#64748b", fontSize: 13 }}>Tidak ada feedback.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {items.slice(0, 80).map((it) => {
                const c = statusColor(it.status);
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => setSelectedId(it.id)}
                    style={{
                      textAlign: "left",
                      cursor: "pointer",
                      border: selectedId === it.id ? "1px solid #0f172a" : "1px solid #e2e8f0",
                      background: selectedId === it.id ? "#0f172a" : "white",
                      color: selectedId === it.id ? "white" : "#0f172a",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 900 }}>{it.category}</div>
                      <span style={{ fontSize: 11, fontWeight: 900, borderRadius: 999, padding: "4px 10px", border: `1px solid ${c.color}`, background: c.bg, color: c.color }}>
                        {statusLabel(it.status)}
                      </span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, color: selectedId === it.id ? "#e2e8f0" : "#475569", lineHeight: 1.35 }}>
                      {it.message.length > 110 ? it.message.slice(0, 110) + "..." : it.message}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: selectedId === it.id ? "#cbd5e1" : "#64748b" }}>
                      {new Date(it.created_at).toLocaleString("id-ID")}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={cardStyle}>
          {!selected ? (
            <div style={{ color: "#64748b", fontSize: 13 }}>Pilih salah satu feedback untuk ditinjau.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>Detail feedback</div>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>{selected.org_code}</span>
              </div>

              <div style={{ color: "#475569", fontSize: 13 }}>
                <div><b>Nama:</b> {selected.name}</div>
                <div><b>Email:</b> {selected.email}</div>
                <div><b>Kategori:</b> {selected.category}</div>
                <div><b>Halaman:</b> {selected.current_route}</div>
                <div style={{ marginTop: 8 }}><b>Pesan:</b></div>
                <div style={{ whiteSpace: "pre-wrap", background: "#f8fafc", padding: 10, borderRadius: 10, border: "1px solid #e2e8f0" }}>{selected.message}</div>
              </div>

              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>Status</label>
                <select
                  value={statusDraft}
                  onChange={(e) => setStatusDraft(e.target.value as FeedbackStatus)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    background: "white",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                <label style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>Catatan admin (opsional)</label>
                <textarea
                  value={adminNoteDraft}
                  onChange={(e) => setAdminNoteDraft(e.target.value)}
                  placeholder="Misalnya: akan dicek minggu ini, akan ditindaklanjuti, dll."
                  style={{
                    ...{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "1px solid #cbd5e1",
                      background: "white",
                      fontSize: 14,
                      boxSizing: "border-box",
                    },
                    minHeight: 90,
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={save}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid #0f172a",
                    background: saving ? "#9ca3af" : "#0f172a",
                    color: "white",
                    fontWeight: 900,
                    cursor: saving ? "not-allowed" : "pointer",
                  }}
                >
                  {saving ? "Menyimpan..." : "Simpan perubahan"}
                </button>
              </div>

              {toast ? <div style={{ fontSize: 13, color: "#166534", fontWeight: 900 }}>{toast}</div> : null}
              {selected.reviewed_at ? (
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Direview: {new Date(selected.reviewed_at).toLocaleString("id-ID")}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

