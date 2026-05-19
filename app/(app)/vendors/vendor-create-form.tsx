"use client";

import { useEffect, useState } from "react";

const TEAL = "#2D7D71";
const BORDER = "#e5e7eb";
const MUTED = "#A0A0A0";

type Props = {
  variant: "modal" | "page";
  onCancel: () => void;
  onSaved: (id: string) => void;
};

export default function VendorCreateForm({ variant, onCancel, onSaved }: Props) {
  const [previewCode, setPreviewCode] = useState("—");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/vendors/preview-code", { credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (alive && json?.preview_code) setPreviewCode(String(json.preview_code));
      } catch {
        if (alive) setPreviewCode("(otomatis)");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    setMsg("");
    if (!name.trim()) return setMsg("Nama vendor wajib diisi.");
    if (!phone.trim()) return setMsg("Nomor telepon wajib diisi.");
    if (!email.trim()) return setMsg("Email wajib diisi.");
    if (!address.trim()) return setMsg("Alamat wajib diisi.");

    setSaving(true);
    try {
      const res = await fetch("/api/vendors/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vendor_code: null,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          note: note.trim() || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(String(json?.error || `Gagal (${res.status})`));
        return;
      }
      if (json?.id) onSaved(String(json.id));
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Gagal simpan.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    fontSize: 15,
    outline: "none",
    background: "#fafafa",
  };

  const label = (text: string, required?: boolean) => (
    <div style={{ fontSize: 14, fontWeight: 700, color: "#333", marginBottom: 8 }}>
      {text}
      {required ? <span style={{ color: "#dc2626", marginLeft: 2 }}>*</span> : null}
    </div>
  );

  const fields = (
    <div style={{ display: "grid", gap: variant === "modal" ? 18 : 16 }}>
      <div>
        {label("Vendor Code (otomatis)")}
        <input readOnly value={previewCode} style={{ ...inputStyle, background: "#f3f4f6", color: "#64748b" }} />
      </div>

      <div>
        {label("Nama Vendor", true)}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tulis nama vendor"
          style={inputStyle}
        />
      </div>

      <div>
        {label("Nomor Telepon", true)}
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Tulis nomor telepon"
          style={inputStyle}
        />
      </div>

      <div>
        {label("Email", true)}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Tulis email"
          style={inputStyle}
        />
      </div>

      <div>
        {label("Alamat", true)}
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Tulis alamat vendor"
          rows={4}
          style={{ ...inputStyle, resize: "vertical", minHeight: 100, lineHeight: 1.45 }}
        />
      </div>

      <div>
        {label("Catatan (opsional)")}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Tulis catatan"
          rows={3}
          style={{ ...inputStyle, resize: "vertical", minHeight: 80, lineHeight: 1.45 }}
        />
      </div>

      {msg ? (
        <div style={{ padding: 12, borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontWeight: 700, fontSize: 14 }}>
          {msg}
        </div>
      ) : null}
    </div>
  );

  const footerBtns =
    variant === "modal" ? (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 24 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: "14px 16px",
            borderRadius: 8,
            border: `2px solid ${TEAL}`,
            background: "#fff",
            color: TEAL,
            fontWeight: 700,
            fontSize: 15,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          Batalkan
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            padding: "14px 16px",
            borderRadius: 8,
            border: "none",
            background: saving ? "#8fb3af" : TEAL,
            color: "#fff",
            fontWeight: 700,
            fontSize: 15,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Menyimpan…" : "Simpan Data Vendor"}
        </button>
      </div>
    ) : (
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: "12px 22px",
            borderRadius: 8,
            border: `2px solid ${TEAL}`,
            background: "#fff",
            color: TEAL,
            fontWeight: 700,
            fontSize: 15,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          Kembali
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            padding: "12px 22px",
            borderRadius: 8,
            border: "none",
            background: saving ? "#8fb3af" : TEAL,
            color: "#fff",
            fontWeight: 700,
            fontSize: 15,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Menyimpan…" : "Simpan Data Vendor"}
        </button>
      </div>
    );

  if (variant === "page") {
    return (
      <div>
        {fields}
        {footerBtns}
        <p style={{ marginTop: 12, fontSize: 13, color: MUTED }}>Kode vendor diisi otomatis oleh sistem.</p>
      </div>
    );
  }

  return (
    <div>
      {fields}
      {footerBtns}
    </div>
  );
}
