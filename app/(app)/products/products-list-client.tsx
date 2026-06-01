"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { rupiah } from "@/lib/money";
import ProductForm, { type ProductRow } from "./product-form";
import { tableActionDanger, tableActionSecondary } from "../components/app-action-buttons";
import TableEmptyState from "../components/table-empty-state";
import { ul } from "../components/unified-list-table";

const TEAL = "#2D7D71";
const BG = "#F8F9FA";
const BORDER = "#e5e7eb";

export default function ProductsListClient({
  orgId,
  initialRows,
}: {
  orgId: string;
  initialRows: ProductRow[];
}) {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [rows, setRows] = useState<ProductRow[]>(initialRows);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function refreshList() {
    setRefreshing(true);
    setErr("");
    try {
      router.refresh();
      const { data, error } = await supabase
        .from("products")
        .select("id,name,sku,unit,price,is_active,created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) throw error;
      setRows((data as ProductRow[]) || []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal memuat barang.");
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter((r) => {
      const hay = `${r.name || ""} ${r.sku || ""} ${r.unit || ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [rows, q]);

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const fromIdx = (page - 1) * pageSize;
  const paginated = useMemo(() => filtered.slice(fromIdx, fromIdx + pageSize), [filtered, fromIdx, pageSize]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  function openCreate() {
    setModalMode("create");
    setEditProduct(null);
    setModalOpen(true);
  }

  function openEdit(p: ProductRow) {
    setModalMode("edit");
    setEditProduct(p);
    setModalOpen(true);
  }

  async function toggleActive(id: string, next: boolean) {
    setTogglingId(id);
    try {
      const res = await fetch("/api/products", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(String(json?.error || "Gagal ubah status"));
        return;
      }
      await refreshList();
    } finally {
      setTogglingId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Hapus barang ini? Tindakan ini tidak dapat dibatalkan.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/products?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(String(json?.error || "Gagal hapus"));
        return;
      }
      await refreshList();
      if (modalOpen && editProduct?.id === id) {
        setModalOpen(false);
        setEditProduct(null);
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ width: "100%", boxSizing: "border-box", background: BG, minHeight: "100%", padding: "16px 20px 40px" }}>
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
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#333" }}>Barang</h1>
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
        <div style={{ fontSize: 18, fontWeight: 800, color: "#333", marginBottom: 16 }}>Master Data Barang</div>

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
              placeholder="Cari nama/sku/satuan"
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
            onClick={openCreate}
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
            Tambah Barang
          </button>
        </div>

        <div className={ul.scroll}>
          <table className={`${ul.table} app-table--products`} style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th className={ul.th}>Nama Barang</th>
                <th className={ul.th}>Satuan</th>
                <th className={ul.thRight}>Harga</th>
                <th className={ul.thCenter}>Status</th>
                <th className={ul.th}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {refreshing ? (
                <tr>
                  <td colSpan={5} className={ul.loading}>
                    Memperbarui…
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <TableEmptyState colSpan={5} message="Belum ada data barang." />
              ) : (
                paginated.map((p) => {
                  const active = p.is_active !== false;
                  return (
                    <tr key={p.id}>
                      <td className={ul.tdTop}>
                        <span className={ul.primaryText}>{p.name}</span>
                        {p.sku ? <div className={ul.primaryMeta}>SKU: {p.sku}</div> : null}
                      </td>
                      <td className={ul.td}>{p.unit || "—"}</td>
                      <td className={ul.tdRight}>
                        <span className={ul.money}>{rupiah(Number(p.price || 0))}</span>
                      </td>
                      <td className={ul.tdCenter}>
                        <TableStatusToggle
                          active={active}
                          disabled={togglingId === p.id}
                          onChange={(next) => toggleActive(p.id, next)}
                        />
                      </td>
                      <td className={`${ul.td} app-td-actions`}>
                        <div className={ul.actions}>
                          <button type="button" onClick={() => openEdit(p)} style={tableActionSecondary()}>
                            <EditIcon />
                            Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(p.id)}
                            disabled={deletingId === p.id}
                            style={{
                              ...tableActionDanger(),
                              cursor: deletingId === p.id ? "not-allowed" : "pointer",
                              opacity: deletingId === p.id ? 0.6 : 1,
                            }}
                          >
                            <TrashIcon />
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

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
            if (e.target === e.currentTarget) {
              setModalOpen(false);
              setEditProduct(null);
            }
          }}
        >
          <div
            style={{
              width: "min(520px, 100%)",
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
              onClick={() => {
                setModalOpen(false);
                setEditProduct(null);
              }}
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

            <h2 style={{ margin: "8px 0 0 44px", fontSize: 20, fontWeight: 800, color: "#333" }}>
              {modalMode === "edit" ? "Ubah Barang" : "Tambah Barang"}
            </h2>

            <div style={{ marginTop: 20 }}>
              <ProductForm
                variant="modal"
                mode={modalMode}
                initial={editProduct}
                onCancel={() => {
                  setModalOpen(false);
                  setEditProduct(null);
                }}
                onSuccess={() => {
                  setModalOpen(false);
                  setEditProduct(null);
                  refreshList();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TableStatusToggle({
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
    border: "1px solid rgba(45, 125, 113, 0.22)",
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

function TrashIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1-3h10l1 3M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
        stroke="#c62828"
        strokeWidth="1.6"
        strokeLinecap="round"
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
