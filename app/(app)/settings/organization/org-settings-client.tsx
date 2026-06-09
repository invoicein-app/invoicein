"use client";

import Link from "next/link";
import { useState } from "react";
import FormSubmitButton from "../../components/form-submit-button";
import { useSubmitGuard } from "../../components/use-submit-guard";
import OrgLogoClient from "./org-logo-client";

const TEAL = "#1D7A73";
const BG = "#F8F9FA";
const BORDER = "#e5e7eb";
const LABEL = "#333333";
const MUTED = "#A0A0A0";

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
  logo_url?: string;
  public_document_code: string;
  invoice_prefix: string;
  po_prefix: string;
  quotation_prefix: string;
};

const BANK_OPTIONS = [
  "BCA",
  "Mandiri",
  "BRI",
  "BNI",
  "BSI",
  "CIMB Niaga",
  "Permata",
  "Danamon",
  "Maybank",
  "OCBC NISP",
  "Bank Jago",
  "SeaBank",
  "Lainnya",
];

const BANK_SET = new Set(BANK_OPTIONS);

function cleanCode(v: string) {
  return String(v || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 12);
}

function cleanPrefix(v: string, fallback: string) {
  return cleanCode(v) || fallback;
}

const inputBase: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  outline: "none",
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box",
  background: "#fff",
};

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ fontSize: 14, fontWeight: 700, color: LABEL, marginBottom: 8 }}>
      {children}
      {required ? <span style={{ color: "#dc2626", marginLeft: 2 }}>*</span> : null}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...inputBase,
      }}
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...inputBase,
        resize: "vertical",
        minHeight: 100,
        lineHeight: 1.45,
      }}
    />
  );
}

function SectionDivider() {
  return (
    <div
      style={{
        height: 1,
        background: BORDER,
        margin: "28px 0",
      }}
      aria-hidden
    />
  );
}

export default function OrgSettingsClient({ initial }: { initial: OrgForm }) {
  const [form, setForm] = useState<OrgForm>(initial);
  const [loading, setLoading] = useState(false);
  const { tryBegin, end, isBlocked } = useSubmitGuard(setLoading);

  async function save() {
    if (isBlocked()) return;
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim() || !form.address.trim()) {
      alert("Lengkapi Nama Usaha, No Telepon, Email, dan Alamat Usaha.");
      return;
    }

    const payload: OrgForm = {
      ...form,
      public_document_code: cleanCode(form.public_document_code),
      invoice_prefix: cleanPrefix(form.invoice_prefix, "INV"),
      po_prefix: cleanPrefix(form.po_prefix, "PO"),
      quotation_prefix: cleanPrefix(form.quotation_prefix, "QUO"),
    };

    if (!tryBegin()) return;
    try {
      const res = await fetch("/api/org/profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        json = { error: text };
      }

      if (!res.ok) {
        alert(String(json?.error || `Gagal (${res.status})`));
        return;
      }

      setForm(payload);
      alert("Tersimpan ✅");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Gagal simpan");
    } finally {
      end();
    }
  }

  const grid3: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  };

  return (
    <div style={{ width: "100%", boxSizing: "border-box", background: BG, minHeight: "100%", padding: "16px 20px 40px" }}>
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
          <Link
            href="/settings"
            title="Kembali ke Pengaturan"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: `1px solid ${BORDER}`,
              display: "grid",
              placeItems: "center",
              textDecoration: "none",
              color: TEAL,
              background: "#fff",
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            <BackIcon />
          </Link>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: LABEL }}>Pengaturan Usaha</h1>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>Pengaturan / Pengaturan Usaha</div>
          </div>
        </div>

        <FormSubmitButton
          type="button"
          onClick={save}
          busy={loading}
          busyLabel="Menyimpan…"
          style={{
            padding: "12px 22px",
            borderRadius: 8,
            border: "none",
            background: TEAL,
            fontSize: 15,
            whiteSpace: "nowrap",
          }}
        >
          Simpan Pengaturan
        </FormSubmitButton>
      </div>

      {/* Single card */}
      <div
        style={{
          marginTop: 20,
          background: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          padding: "28px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          boxSizing: "border-box",
        }}
      >
        <OrgLogoClient currentUrl={initial.logo_url || ""} embedded />

        <SectionDivider />

        <div style={{ fontSize: 16, fontWeight: 800, color: LABEL, marginBottom: 20 }}>Identitas Usaha</div>

        <div style={grid3}>
          <div>
            <FieldLabel required>Nama Usaha</FieldLabel>
            <Input
              value={form.name}
              onChange={(v) => setForm((p) => ({ ...p, name: v }))}
              placeholder="Tulis nama usaha"
            />
          </div>
          <div>
            <FieldLabel required>No Telepon</FieldLabel>
            <Input
              value={form.phone}
              onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
              placeholder="Tulis no telepon"
            />
          </div>
          <div>
            <FieldLabel required>Email</FieldLabel>
            <Input
              type="email"
              value={form.email}
              onChange={(v) => setForm((p) => ({ ...p, email: v }))}
              placeholder="Tulis email"
            />
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <FieldLabel required>Alamat Usaha</FieldLabel>
          <TextArea
            value={form.address}
            onChange={(v) => setForm((p) => ({ ...p, address: v }))}
            placeholder="Tulis alamat usaha"
            rows={4}
          />
        </div>

        <SectionDivider />

        <div style={{ fontSize: 16, fontWeight: 800, color: LABEL, marginBottom: 20 }}>Rekening Opsional</div>

        <div style={grid3}>
          <div>
            <FieldLabel>Nama Bank (opsional)</FieldLabel>
            <select
              value={form.bank_name || ""}
              onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))}
              style={{
                ...inputBase,
                cursor: "pointer",
                appearance: "auto",
                color: form.bank_name ? LABEL : MUTED,
              }}
            >
              <option value="">Pilih bank</option>
              {form.bank_name && !BANK_SET.has(form.bank_name) ? (
                <option value={form.bank_name}>{form.bank_name}</option>
              ) : null}
              {BANK_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Nomor Rekening Bank (opsional)</FieldLabel>
            <Input
              value={form.bank_account}
              onChange={(v) => setForm((p) => ({ ...p, bank_account: v }))}
              placeholder="Tulis no rekening bank"
            />
          </div>
          <div>
            <FieldLabel>Atas Nama Rekening (opsional)</FieldLabel>
            <Input
              value={form.bank_account_name}
              onChange={(v) => setForm((p) => ({ ...p, bank_account_name: v }))}
              placeholder="Tulis atas nama rekening"
            />
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <FieldLabel>Footer Invoice (opsional)</FieldLabel>
          <TextArea
            value={form.invoice_footer}
            onChange={(v) => setForm((p) => ({ ...p, invoice_footer: v }))}
            placeholder="Tulis footer invoice"
            rows={4}
          />
        </div>

        <SectionDivider />

        <div style={{ fontSize: 16, fontWeight: 800, color: LABEL }}>Penomoran Dokumen</div>
        <div style={{ color: MUTED, fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
          Public Document Code bersifat opsional dan akan tampil di dokumen. Jika kosong, nomor dokumen tanpa kode
          perusahaan.
        </div>

        <div style={{ ...grid3, marginTop: 16 }}>
          <div>
            <FieldLabel>Public Document Code (opsional)</FieldLabel>
            <Input
              value={form.public_document_code}
              onChange={(v) => setForm((p) => ({ ...p, public_document_code: cleanCode(v) }))}
              placeholder="Contoh: SV"
            />
          </div>
          <div>
            <FieldLabel>Invoice Prefix</FieldLabel>
            <Input
              value={form.invoice_prefix}
              onChange={(v) => setForm((p) => ({ ...p, invoice_prefix: cleanCode(v) }))}
              placeholder="INV"
            />
          </div>
          <div>
            <FieldLabel>PO Prefix</FieldLabel>
            <Input
              value={form.po_prefix}
              onChange={(v) => setForm((p) => ({ ...p, po_prefix: cleanCode(v) }))}
              placeholder="PO"
            />
          </div>
          <div>
            <FieldLabel>Quotation Prefix</FieldLabel>
            <Input
              value={form.quotation_prefix}
              onChange={(v) => setForm((p) => ({ ...p, quotation_prefix: cleanCode(v) }))}
              placeholder="QUO"
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 20,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: 16,
            background: "#fafafa",
            fontSize: 14,
            color: LABEL,
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 800 }}>Preview</div>
          <div>
            Dengan kode:{" "}
            <strong>
              {cleanPrefix(form.invoice_prefix, "INV") || "INV"}-{cleanCode(form.public_document_code) || "SV"}-20260426-0001
            </strong>
          </div>
          <div>
            Tanpa kode: <strong>{cleanPrefix(form.invoice_prefix, "INV") || "INV"}-20260426-0001</strong>
          </div>
          <div style={{ color: MUTED, fontSize: 13 }}>
            Kode ini bersifat publik dan akan muncul di invoice, purchase order, dan quotation.
          </div>
        </div>
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 18l-6-6 6-6" stroke={TEAL} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
