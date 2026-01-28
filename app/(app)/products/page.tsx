// invoiceku/app/products/page.tsx  (FULL REPLACE)
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { rupiah } from "@/lib/money";

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
    <div style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
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
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Daftar Barang</h3>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama / sku / satuan..."
              style={input()}
            />
          </div>

          <div style={{ marginTop: 10 }}>
            {loading ? (
              <p style={{ color: "#666" }}>Loading...</p>
            ) : filtered.length === 0 ? (
              <p style={{ color: "#666" }}>Belum ada barang.</p>
            ) : (
              <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#fafafa", color: "#555" }}>
                      <th style={th()}>Nama</th>
                      <th style={th()}>SKU</th>
                      <th style={th()}>Satuan</th>
                      <th style={{ ...th(), textAlign: "right" }}>Harga</th>
                      <th style={th()}>Aktif</th>
                      <th style={th()}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id} style={{ borderTop: "1px solid #eee" }}>
                        <td style={td()}>
                          <b>{p.name}</b>
                        </td>
                        <td style={td()}>{p.sku || "-"}</td>
                        <td style={td()}>{p.unit || "-"}</td>
                        <td style={{ ...td(), textAlign: "right" }}>{rupiah(Number(p.price || 0))}</td>
                        <td style={td()}>{p.is_active === false ? "No" : "Yes"}</td>
                        <td style={td()}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button onClick={() => startEdit(p)} disabled={saving} style={miniBtn()}>
                              Edit
                            </button>
                            <button onClick={() => remove(p.id)} disabled={saving} style={miniBtnDanger()}>
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <button onClick={load} disabled={loading || saving} style={btn()}>
                Refresh
              </button>
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