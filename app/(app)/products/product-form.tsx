"use client";

import { useEffect, useState } from "react";
import FormSubmitButton from "../components/form-submit-button";
import { useSubmitGuard } from "../components/use-submit-guard";

const TEAL = "#2D7D71";
const BORDER = "#e5e7eb";

export type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  price: number | null;
  is_active: boolean | null;
};

function asText(v: unknown) {
  return String(v ?? "").trim();
}

function formatRibuan(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseRibuan(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits === "" ? 0 : Number(digits);
}

type Props = {
  variant: "modal" | "page";
  mode: "create" | "edit";
  initial: ProductRow | null;
  onCancel: () => void;
  onSuccess: () => void;
};

export default function ProductForm({ variant, mode, initial, onCancel, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("");
  const [priceText, setPriceText] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const { tryBegin, end, isBlocked } = useSubmitGuard(setSaving);

  useEffect(() => {
    setMsg("");
    if (mode === "edit" && initial) {
      setName(initial.name || "");
      setSku(initial.sku || "");
      setUnit(initial.unit || "");
      const n = Number(initial.price || 0);
      setPriceText(n > 0 ? formatRibuan(String(n)) : "");
      setIsActive(initial.is_active !== false);
    } else {
      setName("");
      setSku("");
      setUnit("");
      setPriceText("");
      setIsActive(true);
    }
  }, [mode, initial]);

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

  function label(text: string, required?: boolean) {
    return (
      <div style={{ fontSize: 14, fontWeight: 700, color: "#333", marginBottom: 8 }}>
        {text}
        {required ? <span style={{ color: "#dc2626", marginLeft: 2 }}>*</span> : null}
      </div>
    );
  }

  async function submit() {
    if (isBlocked()) return;
    setMsg("");
    const nm = asText(name);
    if (!nm) {
      setMsg("Nama barang wajib diisi.");
      return;
    }

    if (!tryBegin()) return;
    try {
      const payload: Record<string, unknown> = {
        name: nm,
        sku: asText(sku) || null,
        unit: asText(unit) || null,
        price: Math.max(0, parseRibuan(priceText)),
        is_active: isActive,
      };

      if (mode === "edit" && initial?.id) {
        payload.id = initial.id;
      }

      const res = await fetch("/api/products", {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(String(json?.error || `Gagal (${res.status})`));
        return;
      }
      onSuccess();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Gagal simpan.");
    } finally {
      end();
    }
  }

  const fields = (
    <div style={{ display: "grid", gap: variant === "modal" ? 18 : 16 }}>
      <div>
        {label("Nama Barang", true)}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tulis nama barang"
          style={inputStyle}
        />
      </div>

      <div>
        {label("SKU (opsional)")}
        <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Tulis SKU" style={inputStyle} />
      </div>

      <div>
        {label("Satuan (opsional)")}
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Contoh : pcs, box, kg"
          style={inputStyle}
        />
      </div>

      <div>
        {label("Harga Default (opsional)")}
        <input
          type="text"
          inputMode="numeric"
          value={priceText}
          onChange={(e) => setPriceText(formatRibuan(e.target.value))}
          placeholder="Contoh : 60.000"
          style={inputStyle}
        />
      </div>

      <div>
        {label("Status")}
        <StatusToggle active={isActive} onChange={setIsActive} disabled={saving} />
      </div>

      {msg ? (
        <div style={{ padding: 12, borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontWeight: 700, fontSize: 14 }}>
          {msg}
        </div>
      ) : null}
    </div>
  );

  const submitLabel = mode === "edit" ? "Simpan Perubahan" : "Tambah Barang Baru";

  const footer =
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
        <FormSubmitButton busy={saving} busyLabel="Menyimpan…" onClick={submit} style={{ padding: "14px 16px", borderRadius: 8, fontSize: 15 }}>
          {submitLabel}
        </FormSubmitButton>
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
        <FormSubmitButton busy={saving} busyLabel="Menyimpan…" onClick={submit} style={{ padding: "12px 22px", borderRadius: 8, fontSize: 15 }}>
          {submitLabel}
        </FormSubmitButton>
      </div>
    );

  return (
    <div>
      {fields}
      {footer}
    </div>
  );
}

function StatusToggle({
  active,
  onChange,
  disabled,
}: {
  active: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
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
      <span style={{ fontSize: 14, fontWeight: 700, color: active ? TEAL : "#94a3b8" }}>{active ? "Aktif" : "Tidak Aktif"}</span>
    </button>
  );
}
