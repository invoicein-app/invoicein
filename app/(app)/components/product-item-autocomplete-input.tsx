"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export type ProductSuggestion = {
  id: string;
  name: string;
  unit: string | null;
  sku: string | null;
};

type DropdownRect = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

type Props = {
  value: string;
  productId: string;
  open: boolean;
  suggestions: ProductSuggestion[];
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
  onSelect: (product: ProductSuggestion) => void;
  placeholder?: string;
  required?: boolean;
  inputStyle?: CSSProperties;
};

const DROPDOWN_MAX_HEIGHT = 240;
const DROPDOWN_Z_INDEX = 10000;

export function ProductItemAutocompleteInput({
  value,
  productId,
  open,
  suggestions,
  onOpenChange,
  onChange,
  onSelect,
  placeholder,
  required,
  inputStyle,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<DropdownRect | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || suggestions.length === 0) {
      setRect(null);
      return;
    }

    const updatePosition = () => {
      const el = inputRef.current;
      if (!el) return;

      const r = el.getBoundingClientRect();
      const width = Math.max(r.width, 280);
      const spaceBelow = window.innerHeight - r.bottom - 8;
      const spaceAbove = r.top - 8;
      const preferBelow = spaceBelow >= 120 || spaceBelow >= spaceAbove;

      let top: number;
      let maxHeight: number;

      if (preferBelow) {
        top = r.bottom + 4;
        maxHeight = Math.min(DROPDOWN_MAX_HEIGHT, Math.max(120, spaceBelow));
      } else {
        maxHeight = Math.min(DROPDOWN_MAX_HEIGHT, Math.max(120, spaceAbove));
        top = Math.max(8, r.top - maxHeight - 4);
      }

      setRect({
        top,
        left: r.left,
        width,
        maxHeight,
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, suggestions.length, value]);

  const showDropdown = mounted && open && suggestions.length > 0 && rect;

  return (
    <>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onOpenChange(true);
        }}
        onFocus={() => onOpenChange(true)}
        onBlur={() => {
          setTimeout(() => onOpenChange(false), 120);
        }}
        placeholder={placeholder}
        style={inputStyle}
        required={required}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showDropdown ? true : undefined}
      />

      {productId ? (
        <div style={{ fontSize: 12, color: "#166534", marginTop: 6 }}>Terhubung ke master produk</div>
      ) : value.trim() ? (
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Item manual (tanpa produk master)</div>
      ) : null}

      {showDropdown
        ? createPortal(
            <div
              role="listbox"
              style={{
                position: "fixed",
                top: rect.top,
                left: rect.left,
                width: rect.width,
                zIndex: DROPDOWN_Z_INDEX,
                border: "1px solid #e5e7eb",
                background: "white",
                borderRadius: 12,
                boxShadow: "0 12px 30px rgba(0,0,0,0.14)",
                overflow: "hidden",
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div style={{ maxHeight: rect.maxHeight, overflowY: "auto" }}>
                {suggestions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    onClick={() => onSelect(p)}
                    style={suggestionBtnStyle}
                  >
                    <div style={{ fontWeight: 800 }}>
                      {p.name}
                      <span style={{ color: "#6b7280", fontWeight: 600 }}>
                        {p.sku ? ` • ${p.sku}` : ""}
                        {p.unit ? ` (${p.unit})` : ""}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

const suggestionBtnStyle: CSSProperties = {
  width: "100%",
  textAlign: "left",
  border: "none",
  background: "white",
  padding: "10px 12px",
  cursor: "pointer",
  borderBottom: "1px solid #f1f5f9",
};
