"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import VendorCreateForm from "./vendor-create-form";
import { tableActionSecondary } from "../components/app-action-buttons";

const TEAL = "#2D7D71";
const BG = "#F8F9FA";
const BORDER = "#e5e7eb";

type VendorRow = {
  id: string;
  vendor_code: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean | null;
  created_at: string | null;
  created_by: string | null;
};

function fmtDateLong(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export default function VendorsListPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [creatorLabels, setCreatorLabels] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        setRows([]);
        setErr("Unauthorized");
        return;
      }

      const { data: membership, error: memErr } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (memErr) throw memErr;

      const orgId = String((membership as { org_id?: string } | null)?.org_id || "");
      if (!orgId) {
        setRows([]);
        setErr("Org tidak ditemukan. Pastikan membership aktif.");
        return;
      }

      const { data, error } = await supabase
        .from("vendors")
        .select("id,vendor_code,name,phone,email,is_active,created_at,created_by")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(800);

      if (error) throw error;

      const list = (data as VendorRow[]) || [];
      setRows(list);

      const ids = [...new Set(list.map((r) => r.created_by).filter(Boolean) as string[])];
      if (ids.length > 0) {
        const res = await fetch("/api/vendors/resolve-users", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json?.labels && typeof json.labels === "object") {
          setCreatorLabels(json.labels as Record<string, string>);
        } else {
          setCreatorLabels({});
        }
      } else {
        setCreatorLabels({});
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal load vendors.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const blob = `${r.vendor_code || ""} ${r.name} ${r.phone || ""} ${r.email || ""}`.toLowerCase();
      return blob.includes(s);
    });
  }, [rows, q]);

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const fromIdx = (page - 1) * pageSize;
  const paginated = useMemo(() => filtered.slice(fromIdx, fromIdx + pageSize), [filtered, fromIdx, pageSize]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  async function toggleActive(id: string, next: boolean) {
    setTogglingId(id);
    try {
      const res = await fetch(`/api/vendors/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(String(json?.error || "Gagal ubah status"));
        return;
      }
      await load();
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div style={{ width: "100%", boxSizing: "border-box", background: BG, minHeight: "100%", padding: "16px 20px 40px" }}>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#333" }}>Vendor</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/settings/activity" title="Notifikasi / aktivitas" style={iconCircle()}>
            <BellIcon />
          </Link>
          <Link href="/settings" title="Profil & pengaturan" style={iconCircle()}>
            <UserIcon />
          </Link>
        </div>
      </div>

      {err ? (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 8,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            fontWeight: 700,
          }}
        >
          {err}
        </div>
      ) : null}

      {/* Card */}
      <div
        style={{
          background: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          padding: "20px 20px 8px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: "#333", marginBottom: 16 }}>Master Data Vendor</div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div style={{ flex: "1 1 280px", minWidth: 0, position: "relative" }}>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Cari kode/nama/nomor telepon vendor"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 44px 12px 14px",
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                fontSize: 14,
                outline: "none",
              }}
            />
            <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <SearchIcon />
            </span>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 18px",
              borderRadius: 8,
              border: "none",
              background: TEAL,
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <PlusIcon />
            Tambah Vendor
          </button>
        </div>

        <div style={{ width: "100%", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {["Vendor Code", "Nama", "Phone", "Dibuat", "Status", "Aksi"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "12px 10px",
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#64748b",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 28, color: "#94a3b8", fontWeight: 600 }}>
                    Memuat…
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 28, color: "#94a3b8", fontWeight: 600 }}>
                    Tidak ada data.
                  </td>
                </tr>
              ) : (
                paginated.map((r) => {
                  const active = r.is_active !== false;
                  const creatorName = r.created_by ? creatorLabels[r.created_by] || "—" : "—";
                  return (
                    <tr key={r.id} style={{ borderBottom: `1px solid #f1f5f9` }}>
                      <td style={{ padding: "14px 10px", fontFamily: "ui-monospace, monospace", fontWeight: 700, color: "#111" }}>
                        {r.vendor_code || "—"}
                      </td>
                      <td style={{ padding: "14px 10px", fontWeight: 700, color: "#111" }}>{r.name}</td>
                      <td style={{ padding: "14px 10px", color: "#334155" }}>{r.phone || "—"}</td>
                      <td style={{ padding: "14px 10px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 800, color: "#111" }}>{creatorName}</div>
                        <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>{fmtDateLong(r.created_at)}</div>
                      </td>
                      <td style={{ padding: "14px 10px" }}>
                        <StatusToggle
                          active={active}
                          disabled={togglingId === r.id}
                          onChange={(next) => toggleActive(r.id, next)}
                        />
                      </td>
                      <td style={{ padding: "14px 10px" }}>
                        <button type="button" onClick={() => router.push(`/vendors/${r.id}/edit`)} style={tableActionSecondary()}>
                          <EditIcon />
                          Ubah
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            marginTop: 16,
            paddingTop: 16,
            paddingBottom: 8,
            borderTop: `1px solid ${BORDER}`,
            fontSize: 13,
            color: "#64748b",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>Menampilkan</span>
            <select
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: `1px solid ${BORDER}`,
                fontWeight: 700,
                color: "#333",
                background: "#fff",
              }}
            >
              {[10, 20, 30, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>
              Dari <b style={{ color: "#333" }}>{totalRows}</b> Data
            </span>
          </div>

          <nav style={{ display: "flex", alignItems: "center", gap: 8 }} aria-label="Pagination">
            {page <= 1 ? (
              <span style={pagerDisabled()}>&lt; Prev</span>
            ) : (
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} style={pagerBtn()}>
                &lt; Prev
              </button>
            )}

            <span style={pagerActive()}>{page}</span>

            {page >= totalPages ? (
              <span style={pagerDisabled()}>Next &gt;</span>
            ) : (
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={pagerBtn()}>
                Next &gt;
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Modal */}
      {modalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.45)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            boxSizing: "border-box",
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              maxHeight: "min(92vh, 900px)",
              overflow: "auto",
              background: "#fff",
              borderRadius: 12,
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
              padding: "24px 22px 22px",
              boxSizing: "border-box",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              aria-label="Tutup"
              style={{
                position: "absolute",
                top: 16,
                left: 16,
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                background: "#fff",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                padding: 0,
              }}
            >
              <CloseIcon />
            </button>

            <h2 style={{ margin: "8px 0 0 44px", fontSize: 20, fontWeight: 800, color: "#333" }}>Buat Vendor Baru</h2>

            <div style={{ marginTop: 20 }}>
              <VendorCreateForm
                variant="modal"
                onCancel={() => setModalOpen(false)}
                onSaved={() => {
                  setModalOpen(false);
                  load();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusToggle({
  active,
  disabled,
  onChange,
}: {
  active: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!active)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        border: "none",
        background: "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: "relative",
          width: 44,
          height: 24,
          borderRadius: 999,
          background: active ? TEAL : "#d1d5db",
          flexShrink: 0,
          transition: "background 0.15s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: active ? 22 : 3,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            transition: "left 0.15s",
          }}
        />
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: active ? TEAL : "#94a3b8" }}>{active ? "Aktif" : "Tidak Aktif"}</span>
    </button>
  );
}

function iconCircle(): React.CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "rgba(45, 125, 113, 0.12)",
    display: "grid",
    placeItems: "center",
    textDecoration: "none",
    border: `1px solid rgba(45, 125, 113, 0.22)`,
  };
}

function BellIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.8" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="#94a3b8" strokeWidth="2" />
      <path d="M16 16l4 4" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.828L17.328 5a2 2 0 0 0-2.828 0L4 15.5V20z"
        stroke={TEAL}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function pagerBtn(): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    background: "#fff",
    color: "#334155",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };
}

function pagerActive(): React.CSSProperties {
  return {
    minWidth: 36,
    height: 36,
    display: "inline-grid",
    placeItems: "center",
    padding: "0 10px",
    borderRadius: "50%",
    background: TEAL,
    color: "#fff",
    fontWeight: 800,
    fontSize: 14,
  };
}

function pagerDisabled(): React.CSSProperties {
  return {
    ...pagerBtn(),
    opacity: 0.45,
    pointerEvents: "none",
    cursor: "not-allowed",
  };
}
