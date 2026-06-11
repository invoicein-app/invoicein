"use client";

import { rupiah } from "@/lib/money";

const TEAL = "#2D7D71";

type Props = {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
};

function SummaryLine({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className="invoice-form-items-totals__line"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 16,
        fontSize: emphasized ? 15 : 13,
        fontWeight: emphasized ? 800 : 600,
        color: emphasized ? "#0f172a" : "#475569",
      }}
    >
      <span>{label}</span>
      <span
        style={{
          fontWeight: emphasized ? 900 : 700,
          color: emphasized ? TEAL : "#334155",
          fontSize: emphasized ? 18 : 13,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** Compact running total below invoice items — reuses parent `calc` values only. */
export default function InvoiceFormItemsTotalsSummary({
  subtotal,
  discount,
  tax,
  total,
}: Props) {
  return (
    <div
      className="invoice-form-items-totals"
      style={{
        marginTop: 14,
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid rgba(45, 125, 113, 0.28)",
        background: "linear-gradient(180deg, #f8fcfb 0%, #f0f9f7 100%)",
        boxSizing: "border-box",
        position: "sticky",
        bottom: 12,
        zIndex: 2,
        boxShadow: "0 2px 10px rgba(45, 125, 113, 0.08)",
      }}
    >
      <div
        className="invoice-form-items-totals__grid"
        style={{
          display: "grid",
          gap: 6,
          maxWidth: 420,
          marginLeft: "auto",
          width: "100%",
        }}
      >
        <SummaryLine label="Subtotal" value={rupiah(subtotal)} />
        <SummaryLine label="Diskon" value={rupiah(discount)} />
        <SummaryLine label="Pajak" value={rupiah(tax)} />
        <div
          style={{
            borderTop: "1px solid rgba(45, 125, 113, 0.2)",
            marginTop: 4,
            paddingTop: 8,
          }}
        >
          <SummaryLine label="Total Invoice" value={rupiah(total)} emphasized />
        </div>
      </div>
    </div>
  );
}
