// ✅ NEW FILE
// invoiceku/app/(app)/vendors/[id]/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Vendor = {
  id: string;
  vendor_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  is_active: boolean | null;
};

export default function VendorEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [vendorCode, setVendorCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [isActive, setIsActive] = useState(true);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/vendors/${encodeURIComponent(id)}`, { method: "GET", credentials: "include" });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || "Gagal load vendor.");

      const v: Vendor = json.vendor as any;
      setVendorCode(v.vendor_code || "");
      setName(v.name || "");
      setPhone(v.phone || "");
      setEmail(v.email || "");
      setAddress(v.address || "");
      setNote(v.note || "");
      setIsActive(v.is_active !== false);
    } catch (e: any) {
      setMsg(e?.message || "Gagal load vendor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save() {
    setMsg("");
    if (!name.trim()) return setMsg("Vendor name wajib diisi.");

    setSaving(true);
    try {
      const res = await fetch(`/api/vendors/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vendor_code: vendorCode.trim() || null,
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          note: note.trim() || null,
          is_active: isActive,
        }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setMsg(json?.error || `Gagal simpan (${res.status})`);
        return;
      }

      router.push(`/vendors/${id}`);
    } catch (e: any) {
      setMsg(e?.message || "Gagal simpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 18, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Edit Vendor</h1>
          <p style={{ marginTop: 6, color: "#666" }}>Ubah data vendor.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push(`/vendors/${id}`)} style={btn()} disabled={saving}>
            Kembali
          </button>
          <button onClick={save} disabled={saving || loading} style={btnPrimary()}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, ...card() }}>
        <h3 style={{ margin: 0 }}>Info Vendor</h3>

        {loading ? <p style={{ color: "#666" }}>Loading...</p> : null}

        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <label style={label()}>
            Vendor Code
            <input value={vendorCode} onChange={(e) => setVendorCode(e.target.value)} style={input()} />
          </label>

          <label style={label()}>
            Nama Vendor (wajib)
            <input value={name} onChange={(e) => setName(e.target.value)} style={input()} />
          </label>

          <label style={label()}>
            Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} style={input()} />
          </label>

          <label style={label()}>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={input()} />
          </label>

          <label style={label()}>
            Alamat
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} style={{ ...input(), minHeight: 80 }} />
          </label>

          <label style={label()}>
            Catatan
            <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ ...input(), minHeight: 80 }} />
          </label>

          <label style={{ ...label(), display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>Active</span>
          </label>

          {msg ? <p style={{ color: "#b00", margin: 0, fontWeight: 800 }}>{msg}</p> : null}
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
  return { padding: 10, borderRadius: 10, border: "1px solid #ddd", width: "100%", boxSizing: "border-box", outline: "none", background: "white" };
}
function btn(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer", color: "#111", fontWeight: 900 };
}
function btnPrimary(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "white", cursor: "pointer", fontWeight: 900 };
}
