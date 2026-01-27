"use client";

import { useState } from "react";

type OrgForm = {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  bank_name: string;
  bank_account: string;
  bank_account_name: string;
  invoice_footer: string;
};

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 800 }}>{label}</div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid #ddd",
          outline: "none",
        }}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 800 }}>{label}</div>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid #ddd",
          outline: "none",
          resize: "vertical",
        }}
      />
    </label>
  );
}

export default function OrgSettingsClient({ initial }: { initial: OrgForm }) {
  const [form, setForm] = useState<OrgForm>(initial);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      const res = await fetch("/api/org/profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {
        json = { error: text };
      }

      if (!res.ok) {
        alert(json?.error || `Gagal (${res.status})`);
        return;
      }

      alert("Tersimpan ✅");
    } catch (e: any) {
      alert(e?.message || "Gagal simpan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 16, background: "white" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontWeight: 900 }}>Identitas Usaha</div>
          <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
            Nama, alamat, kontak, rekening, dan footer invoice.
          </div>
        </div>

        <button
          onClick={save}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #111",
            background: loading ? "#333" : "#111",
            color: "white",
            fontWeight: 900,
            cursor: loading ? "not-allowed" : "pointer",
            minWidth: 140,
          }}
        >
          {loading ? "Menyimpan..." : "Simpan"}
        </button>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        <Input
          label="Nama Usaha"
          value={form.name}
          onChange={(v) => setForm((p) => ({ ...p, name: v }))}
          placeholder="Contoh: CV Surya Veneer"
        />
        <Input
          label="No. Telepon"
          value={form.phone}
          onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
          placeholder="Contoh: 0812xxxxxxx"
        />
        <Input
          label="Email Usaha"
          value={form.email}
          onChange={(v) => setForm((p) => ({ ...p, email: v }))}
          placeholder="Contoh: admin@usahaku.com"
          type="email"
        />
        <Input
          label="Alamat Usaha"
          value={form.address}
          onChange={(v) => setForm((p) => ({ ...p, address: v }))}
          placeholder="Jl. ... Kota ..."
        />
      </div>

      <div style={{ marginTop: 18, fontWeight: 900 }}>Rekening (opsional)</div>
      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        <Input
          label="Nama Bank"
          value={form.bank_name}
          onChange={(v) => setForm((p) => ({ ...p, bank_name: v }))}
          placeholder="BCA / Mandiri / BRI"
        />
        <Input
          label="No. Rekening"
          value={form.bank_account}
          onChange={(v) => setForm((p) => ({ ...p, bank_account: v }))}
          placeholder="1234xxxxxx"
        />
        <Input
          label="Atas Nama"
          value={form.bank_account_name}
          onChange={(v) => setForm((p) => ({ ...p, bank_account_name: v }))}
          placeholder="Nama pemilik rekening"
        />
      </div>

      <div style={{ marginTop: 18 }}>
        <TextArea
          label="Footer Invoice (opsional)"
          value={form.invoice_footer}
          onChange={(v) => setForm((p) => ({ ...p, invoice_footer: v }))}
          placeholder={`Contoh:\nPembayaran ke:\nBCA 1234567890 a/n CV Surya Veneer\n\nTerima kasih.`}
        />
      </div>
    </div>
  );
}