"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { rupiah } from "@/lib/money";
import ListFiltersClient from "../components/list-filters-client";
import { listTableStyles } from "../components/list-page-layout";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  price: number | null;
  is_active: boolean | null;
  created_at?: string;
};

function asText(v: any) {
  return String(v ?? "").trim();
}

// ✅ format ribuan: 60000 -> 60.000
function formatRibuan(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// ✅ parse: "60.000" -> 60000
function parseRibuan(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits === "" ? 0 : Number(digits);
}

export default function ProductsPage() {
  const supabase = supabaseBrowser();

  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // form state
  const [editingId, setEditingId] = useState<string>("");
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("");

  // ✅ price pakai string formatted biar ada titik ribuan
  const [priceText, setPriceText] = useState<string>("");

  const [isActive, setIsActive] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  async function load() {
    setLoading(true);
    setMsg("");
    const { data, error } = await supabase
      .from("products")
      .select("id,name,sku,unit,price,is_active,created_at")
      .order("created_at", { ascending: false });

    if (error) setMsg(error.message);
    setRows((data || []) as any);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setEditingId("");
    setName("");
    setSku("");
    setUnit("");
    setPriceText("");
    setIsActive(true);
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setName(p.name || "");
    setSku(p.sku || "");
    setUnit(p.unit || "");
    // ✅ convert angka -> string ribuan
    const n = Number(p.price || 0);
    setPriceText(n > 0 ? formatRibuan(String(n)) : "");
    setIsActive(p.is_active !== false);
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

  // ✅ CREATE / UPDATE via API (biar activity log masuk)
  async function upsert() {
    setMsg("");
    const nm = asText(name);
    if (!nm) return setMsg("Nama barang wajib diisi.");

    setSaving(true);
    try {
      const payload: any = {
        id: editingId || undefined,
        name: nm,
        sku: asText(sku),
        unit: asText(unit),
        price: Math.max(0, parseRibuan(priceText)), // ✅ angka murni
        is_active: !!isActive,
      };

      const res = await fetch("/api/products", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || "Gagal simpan barang.");

      await load();
      resetForm();
    } catch (e: any) {
      setMsg(e?.message || "Gagal simpan barang.");
    } finally {
      setSaving(false);
    }
  }

  // ✅ DELETE via API (biar activity log masuk)
  async function remove(id: string) {
    if (!confirm("Hapus barang ini?")) return;
    setMsg("");
    setSaving(true);
    try {
      const res = await fetch(`/api/products?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || "Gagal hapus barang.");

      await load();
      if (editingId === id) resetForm();
    } catch (e: any) {
      setMsg(e?.message || "Gagal hapus barang.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ width: "100%", padding: 24, boxSizing: "border-box" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Barang</h1>
          <p style={{ marginTop: 6, color: "#666" }}>
            Opsional SKU. Simpan daftar barang biar gak ngetik ulang saat bikin invoice.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <a href="/dashboard" style={btn()}>
            Dashboard
          </a>
          <a href="/invoice/new" style={btnPrimary()}>
            + Buat Invoice
          </a>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Form */}
        <div style={card()}>
          <h3 style={{ margin: 0 }}>{editingId ? "Edit Barang" : "Tambah Barang"}</h3>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <label style={label()}>
              Nama (wajib)
              <input value={name} onChange={(e) => setName(e.target.value)} style={input()} />
            </label>

            <label style={label()}>
              SKU (optional)
              <input value={sku} onChange={(e) => setSku(e.target.value)} style={input()} />
            </label>

            <label style={label()}>
              Satuan (optional) (contoh: pcs, box, kg)
              <input value={unit} onChange={(e) => setUnit(e.target.value)} style={input()} />
            </label>

            <label style={label()}>
              Harga default (optional)
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="contoh: 60.000"
                value={priceText}
                onChange={(e) => setPriceText(formatRibuan(e.target.value))}
                style={input()}
              />
              <small style={{ color: "#666" }}>
                Otomatis pakai titik ribuan. Disimpan sebagai angka (tanpa titik).
              </small>
            </label>

            <label style={{ ...label(), display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox" checked={!!isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Aktif
            </label>

            {msg ? <p style={{ color: "#b00", margin: "4px 0 0" }}>{msg}</p> : null}

            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button onClick={upsert} disabled={saving} style={btnPrimary()}>
                {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Barang"}
              </button>
              <button onClick={resetForm} disabled={saving} style={btn()}>
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        <div style={card()}>
          <h3 style={{ margin: 0 }}>Daftar Barang</h3>
          <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: "1px solid #eee", background: "white" }}>
            <ListFiltersClient
              searchPlaceholder="Cari nama / sku / satuan..."
              searchValue={q}
              onSearchChange={setQ}
              onReset={() => { setQ(""); setPage(1); }}
              perPage={pageSize}
              onPerPageChange={(v) => { setPageSize(v); setPage(1); }}
              perPageOptions={[10, 20, 30, 50]}
            >
              <button type="button" onClick={load} disabled={loading || saving} style={btn()}>Refresh</button>
            </ListFiltersClient>
          </div>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, color: "#666", fontSize: 13 }}>
            <div>Total: <b>{totalRows}</b> • Page: <b>{Math.min(page, totalPages)}</b> / <b>{totalPages}</b> • Per page: <b>{pageSize}</b></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setPage(1)} style={pagerBtn()}>« First</button>
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} style={pagerBtn()}>‹ Prev</button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={pagerBtn()}>Next ›</button>
              <button type="button" onClick={() => setPage(totalPages)} style={pagerBtn()}>Last »</button>
            </div>
          </div>
          <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 14, overflowX: "auto", background: "white" }}>
            {loading ? (
              <p style={{ padding: 20, color: "#666" }}>Loading...</p>
            ) : paginated.length === 0 ? (
              <p style={{ padding: 20, color: "#666" }}>Belum ada barang.</p>
            ) : (
              <table style={listTableStyles.table}>
                <thead>
                  <tr style={listTableStyles.thead}>
                    <th style={listTableStyles.th}>Nama</th>
                    <th style={listTableStyles.th}>SKU</th>
                    <th style={listTableStyles.th}>Satuan</th>
                    <th style={{ ...listTableStyles.th, textAlign: "right" }}>Harga</th>
                    <th style={listTableStyles.th}>Aktif</th>
                    <th style={listTableStyles.th}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((p) => (
                    <tr key={p.id}>
                      <td style={listTableStyles.td}><b>{p.name}</b></td>
                      <td style={listTableStyles.td}>{p.sku || "-"}</td>
                      <td style={listTableStyles.td}>{p.unit || "-"}</td>
                      <td style={{ ...listTableStyles.td, textAlign: "right" }}>{rupiah(Number(p.price || 0))}</td>
                      <td style={listTableStyles.td}>{p.is_active === false ? "No" : "Yes"}</td>
                      <td style={listTableStyles.td}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button onClick={() => startEdit(p)} disabled={saving} style={miniBtn()}>Edit</button>
                          <button onClick={() => remove(p.id)} disabled={saving} style={miniBtnDanger()}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, color: "#666", fontSize: 13 }}>
            <div>Menampilkan <b>{Math.min(fromIdx + 1, totalRows)}</b>–<b>{Math.min(fromIdx + paginated.length, totalRows)}</b> dari <b>{totalRows}</b></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setPage(1)} style={pagerBtn()}>« First</button>
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} style={pagerBtn()}>‹ Prev</button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={pagerBtn()}>Next ›</button>
              <button type="button" onClick={() => setPage(totalPages)} style={pagerBtn()}>Last »</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function card(): React.CSSProperties {
  return { border: "1px solid #eee", borderRadius: 12, padding: 14, background: "white" };
}
function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 13, color: "#444" };
}
function input(): React.CSSProperties {
  return { padding: 10, borderRadius: 10, border: "1px solid #ddd", width: "100%" };
}
function btn(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer" };
}
function btnPrimary(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "white", cursor: "pointer" };
}
function th(): React.CSSProperties {
  return { textAlign: "left", borderBottom: "1px solid #eee", padding: "10px 8px", fontWeight: 700, fontSize: 12 };
}
function td(): React.CSSProperties {
  return { padding: "10px 8px", verticalAlign: "top" };
}
function miniBtn(): React.CSSProperties {
  return { padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer" };
}
function miniBtnDanger(): React.CSSProperties {
  return { padding: "6px 10px", borderRadius: 10, border: "1px solid #b00", background: "#fff5f5", cursor: "pointer" };
}
function pagerBtn(): React.CSSProperties {
  return { padding: "8px 10px", borderRadius: 10, border: "1px solid #eee", background: "white", cursor: "pointer", color: "#111", fontWeight: 600 };
}