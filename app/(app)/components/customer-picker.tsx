"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  filterCustomersForSearch,
  formatCustomerPickerLabel,
  type CustomerSearchSource,
} from "@/lib/customer-search";

export type CustomerPickerOption = CustomerSearchSource & {
  id: string;
};

type Props = {
  customers: CustomerPickerOption[];
  value: string;
  onChange: (customerId: string) => void;
  disabled?: boolean;
  loading?: boolean;
  inputStyle?: CSSProperties;
  placeholder?: string;
  emptyLabel?: string;
  emptyHint?: string;
  showClearOption?: boolean;
};

function dropdownBox(): CSSProperties {
  return {
    position: "absolute",
    left: 0,
    right: 0,
    top: "calc(100% + 4px)",
    zIndex: 50,
    border: "1px solid #e5e7eb",
    background: "white",
    borderRadius: 12,
    boxShadow: "0 12px 30px rgba(0, 0, 0, 0.12)",
    overflow: "hidden",
    maxHeight: 260,
    overflowY: "auto",
  };
}

function optionBtn(active = false): CSSProperties {
  return {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    border: "none",
    borderBottom: "1px solid #f3f4f6",
    background: active ? "#f0fdf4" : "white",
    cursor: "pointer",
    fontSize: 14,
    color: "#111827",
  };
}

export default function CustomerPicker({
  customers,
  value,
  onChange,
  disabled = false,
  loading = false,
  inputStyle,
  placeholder = "Ketik nama customer...",
  emptyLabel = "- manual -",
  emptyHint = "Isi nama customer sendiri di bawah",
  showClearOption = true,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => customers.find((c) => c.id === value) || null,
    [customers, value]
  );

  useEffect(() => {
    if (open) return;
    setQuery(selected ? formatCustomerPickerLabel(selected) : "");
  }, [selected, open, value]);

  const suggestions = useMemo(() => {
    if (!open) return [];
    return filterCustomersForSearch(customers, query, 20);
  }, [customers, open, query]);

  function closePicker() {
    setOpen(false);
    setQuery(selected ? formatCustomerPickerLabel(selected) : "");
  }

  function pickManual() {
    onChange("");
    setQuery("");
    setOpen(false);
  }

  function pickCustomer(customer: CustomerPickerOption) {
    onChange(customer.id);
    setQuery(formatCustomerPickerLabel(customer));
    setOpen(false);
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={query}
        disabled={disabled || loading}
        placeholder={loading ? "Loading customer..." : placeholder}
        autoComplete="off"
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          if (value) {
            const currentLabel = selected ? formatCustomerPickerLabel(selected) : "";
            if (next !== currentLabel) onChange("");
          }
        }}
        onFocus={() => {
          if (disabled || loading) return;
          setOpen(true);
          if (selected) {
            setQuery("");
          }
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (!rootRef.current?.contains(document.activeElement)) {
              closePicker();
            }
          }, 140);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            closePicker();
          }
        }}
        style={inputStyle}
      />

      {open && !disabled && !loading ? (
        <div style={dropdownBox()} role="listbox">
          {showClearOption ? (
            <button
              type="button"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={pickManual}
              style={optionBtn(!value)}
            >
              <span style={{ fontWeight: 700 }}>{emptyLabel}</span>
              {emptyHint ? (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{emptyHint}</div>
              ) : null}
            </button>
          ) : null}

          {suggestions.length === 0 ? (
            <div style={{ padding: "12px", fontSize: 13, color: "#6b7280" }}>
              {query.trim() ? "Customer tidak ditemukan." : "Belum ada customer."}
            </div>
          ) : (
            suggestions.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={c.id === value}
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => pickCustomer(c)}
                style={optionBtn(c.id === value)}
              >
                <div style={{ fontWeight: 700 }}>{c.name}</div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
