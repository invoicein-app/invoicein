// ✅ FULL REPLACE (READ-ONLY CODE)
// invoiceku/app/(app)/warehouses/new/page.tsx
// - field "Kode Gudang" tetap tampil tapi READ ONLY
// - backend auto-generate (trigger) jadi user gak bisa edit

"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WarehouseNewPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // code read-only (biarkan kosong, nanti muncul setelah save / di detail)
  const [code] = useState<string>("(auto)");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(true);

  async function save() {
    setMsg("");

    if (!name.trim()) return setMsg("Nama gudang wajib diisi.");
    if (!address.trim()) return setMsg("Alamat wajib diisi.");

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim(),
        is_active: isActive,
        // ✅ jangan kirim code -> biar trigger yang isi
      };

      const res = await fetch("/api/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) return setMsg(json?.error || `Gagal simpan (${res.status})`);

      // asumsi API balikin { id }
      router.push(`/warehouses`);
    } catch (e: any) {
      setMsg(e?.message || "Gagal simpan gudang.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 18, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Gudang Baru</h1>
          <p style={{ marginTop: 6, color: "#666" }}>Kode gudang otomatis dibuat sistem.</p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/warehouses" style={btn()}>
            Kembali
          </Link>
          <button onClick={save} disabled={saving} style={btnPrimary()}>
            {saving ? "Menyimpan..." : "Simpan Gudang"}
          </button>
        </div>
      </div>

      {msg ? <div style={errBox()}>{msg}</div> : null}

      <div style={{ marginTop: 14, ...card() }}>
        <div style={{ display: "grid", gap: 12 }}>
          <label style={label()}>
            Kode Gudang (auto)
            <input value={code} readOnly disabled style={{ ...input(), background: "#f9fafb", color: "#6b7280" }} />
            <small style={{ color: "#6b7280" }}>Akan menjadi seperti: WH-0001, WH-0002, dst. (unik per org).</small>
          </label>

          <label style={label()}>
            Nama Gudang
            <input value={name} onChange={(e) => setName(e.target.value)} style={input()} placeholder="Contoh: Gudang Utama" />
          </label>

          <label style={label()}>
            No Telp (optional)
            <input value={phone} onChange={(e) => setPhone(e.target.value)} style={input()} placeholder="08xxxx" />
          </label>

          <label style={label()}>
            Alamat (wajib)
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={{ ...input(), minHeight: 110, resize: "vertical" }}
              placeholder="Alamat gudang..."
            />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#444" }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Gudang aktif
          </label>
        </div>
      </div>
    </div>
  );
}

function card(): React.CSSProperties {
  return { border: "1px solid #eee", borderRadius: 12, padding: 14, background: "white", boxSizing: "border-box" };
}
function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 13, color: "#444" };
}
function input(): React.CSSProperties {
  return {
    padding: 10,
    borderRadius: 10,
    border: "1px solid #ddd",
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    background: "white",
  };
}
function btn(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer", textDecoration: "none", color: "#111" };
}
function btnPrimary(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "white", cursor: "pointer" };
}
function errBox(): React.CSSProperties {
  return { marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 900 };
}
