// ✅ NEW FILE
// invoiceku/app/(app)/vendors/new/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function VendorNewPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [vendorCode, setVendorCode] = useState(""); // optional (auto if empty)
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    // just to ensure session exists (optional)
    supabase.auth.getUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setMsg("");
    if (!name.trim()) return setMsg("Vendor name wajib diisi.");

    setSaving(true);
    try {
      const res = await fetch("/api/vendors/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vendor_code: vendorCode.trim() || null,
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          note: note.trim() || null,
        }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setMsg(json?.error || `Gagal simpan (${res.status})`);
        return;
      }

      router.push(`/vendors/${json.id}`);
    } catch (e: any) {
      setMsg(e?.message || "Gagal simpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ width: "100%", padding: 24, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Vendor Baru</h1>
          <p style={{ marginTop: 6, color: "#666" }}>Vendor code otomatis kalau dikosongin.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/vendors")} style={btn()} disabled={saving}>
            Kembali
          </button>
          <button onClick={save} disabled={saving} style={btnPrimary()}>
            {saving ? "Menyimpan..." : "Simpan Vendor"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, ...card() }}>
        <h3 style={{ margin: 0 }}>Info Vendor</h3>

        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <label style={label()}>
            Vendor Code (optional)
            <input
              value={vendorCode}
              onChange={(e) => setVendorCode(e.target.value)}
              placeholder="kosongkan untuk auto (VND-0001)"
              style={input()}
            />
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
