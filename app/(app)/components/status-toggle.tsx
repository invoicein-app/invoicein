"use client";

import type { CSSProperties } from "react";

const TEAL = "#2D7D71";

type Props = {
  active: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Tampilan form: kartu dengan label & penjelasan singkat. */
  variant?: "inline" | "form";
  activeLabel?: string;
  inactiveLabel?: string;
  formTitle?: string;
  formHint?: string;
};

export function StatusToggle({
  active,
  onChange,
  disabled,
  variant = "inline",
  activeLabel = "Aktif",
  inactiveLabel = "Nonaktif",
  formTitle = "Status template",
  formHint = "Nonaktif: template tidak otomatis dicatat ke Pengeluaran. Aktif: dicatat otomatis tiap periode (harian/minggu/bulan).",
}: Props) {
  const toggle = (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={active ? activeLabel : inactiveLabel}
      disabled={disabled}
      onClick={() => onChange(!active)}
      style={toggleButtonStyle(disabled)}
    >
      <span style={trackStyle(active)}>
        <span style={thumbStyle(active)} />
      </span>
      <span style={stateTextStyle(active)}>{active ? activeLabel : inactiveLabel}</span>
    </button>
  );

  if (variant === "form") {
    return (
      <div style={formCardStyle()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>{formTitle}</div>
            <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.45, color: "#64748b", fontWeight: 500 }}>
              {formHint}
            </p>
          </div>
          <div style={{ flexShrink: 0, paddingTop: 2 }}>{toggle}</div>
        </div>
      </div>
    );
  }

  return toggle;
}

function toggleButtonStyle(disabled?: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    border: "none",
    background: "transparent",
    cursor: disabled ? "not-allowed" : "pointer",
    padding: 0,
    opacity: disabled ? 0.6 : 1,
  };
}

function trackStyle(active: boolean): CSSProperties {
  return {
    position: "relative",
    width: 44,
    height: 24,
    borderRadius: 999,
    background: active ? TEAL : "#d1d5db",
    flexShrink: 0,
    transition: "background 0.15s ease",
  };
}

function thumbStyle(active: boolean): CSSProperties {
  return {
    position: "absolute",
    top: 3,
    left: active ? 22 : 3,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
    transition: "left 0.15s ease",
  };
}

function stateTextStyle(active: boolean): CSSProperties {
  return {
    fontSize: 14,
    fontWeight: 800,
    color: active ? TEAL : "#64748b",
    whiteSpace: "nowrap",
  };
}

function formCardStyle(): CSSProperties {
  return {
    padding: "14px 16px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    boxSizing: "border-box",
  };
}
