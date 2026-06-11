"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import InvoiceExportClient from "./invoice-export-client";

const TEAL = "#2D7D71";
const BORDER = "#E2E8F0";

type CustomerOption = { id: string; name: string };

export default function InvoiceFiltersClient({
  customers,
}: {
  customers: CustomerOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const invParam = sp.get("inv") || "";
  const custIdParam = sp.get("custId") || "";
  const payParam = sp.get("pay") || "";
  const fromParam = sp.get("from") || "";
  const toParam = sp.get("to") || "";

  const [inv, setInv] = useState(invParam);
  const [custId, setCustId] = useState(custIdParam);
  const [pay, setPay] = useState(payParam);
  const [from, setFrom] = useState(fromParam);
  const [to, setTo] = useState(toParam);

  useEffect(() => setInv(invParam), [invParam]);
  useEffect(() => setCustId(custIdParam), [custIdParam]);
  useEffect(() => setPay(payParam), [payParam]);
  useEffect(() => setFrom(fromParam), [fromParam]);
  useEffect(() => setTo(toParam), [toParam]);

  const baseParams = useMemo(() => {
    const p = new URLSearchParams(sp.toString());
    p.set("p", "1");
    return p;
  }, [sp]);

  function pushParams(next: URLSearchParams) {
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(baseParams.toString());
      if (inv.trim()) next.set("inv", inv.trim());
      else next.delete("inv");
      pushParams(next);
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv]);

  useEffect(() => {
    const next = new URLSearchParams(baseParams.toString());
    if (custId) next.set("custId", custId);
    else next.delete("custId");
    if (pay) next.set("pay", pay);
    else next.delete("pay");
    if (from) next.set("from", from);
    else next.delete("from");
    if (to) next.set("to", to);
    else next.delete("to");
    pushParams(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custId, pay, from, to]);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 40px 10px 14px",
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    outline: "none",
    boxSizing: "border-box",
    fontSize: 14,
    color: "#0f172a",
    fontWeight: 700,
    background: "#fff",
  };

  const selectStyle: React.CSSProperties = {
    padding: "10px 32px 10px 12px",
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    outline: "none",
    fontSize: 14,
    color: "#0f172a",
    fontWeight: 700,
    background: "#fff",
    minWidth: 160,
    cursor: "pointer",
    appearance: "none" as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
  };

  return (
    <div>
      {/* Top: title + search + CTA */}
      <div
        className="invoice-filters-top"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#333" }}>Rekap Data Invoice</h2>
        <div style={{ flex: "1 1 120px", minWidth: 0 }} />

        <div className="invoice-filters-search" style={{ position: "relative", flex: "1 1 260px", maxWidth: 420, minWidth: 200 }}>
          <input
            value={inv}
            onChange={(e) => setInv(e.target.value)}
            placeholder="Cari nomor invoice"
            style={inputStyle}
          />
          <span
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              opacity: 0.5,
            }}
            aria-hidden
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4.3-4.3" strokeLinecap="round" />
            </svg>
          </span>
        </div>

        <Link
          href="/invoice/new"
          className="invoice-filters-cta"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 18px",
            borderRadius: 8,
            background: TEAL,
            color: "#fff",
            fontWeight: 800,
            fontSize: 14,
            textDecoration: "none",
            whiteSpace: "nowrap",
            boxShadow: "0 2px 8px rgba(27,122,115,0.25)",
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
          Buat Invoice
        </Link>
      </div>

      {/* Filter row */}
      <div
        className="invoice-filters-row"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 800, color: "#333" }}>Filter</span>

        <select value={custId} onChange={(e) => setCustId(e.target.value)} style={selectStyle}>
          <option value="">Semua Pelanggan</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select value={pay} onChange={(e) => setPay(e.target.value)} style={selectStyle}>
          <option value="">Semua Status</option>
          <option value="DRAFT">DRAFT</option>
          <option value="UNPAID">UNPAID</option>
          <option value="PARTIAL">PARTIAL</option>
          <option value="PAID">PAID</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              background: "#fff",
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.75" aria-hidden>
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
            </svg>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{
                border: "none",
                outline: "none",
                fontSize: 13,
                fontWeight: 600,
                color: "#475569",
                background: "transparent",
              }}
            />
            <span style={{ color: "#94a3b8" }}>–</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{
                border: "none",
                outline: "none",
                fontSize: 13,
                fontWeight: 600,
                color: "#475569",
                background: "transparent",
              }}
            />
          </span>
        </div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <InvoiceExportClient />
          <button
            type="button"
            className="invoice-filters-reset"
            onClick={() => router.push(pathname)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              background: "#fff",
              color: "#64748b",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Reset filter
          </button>
        </div>
      </div>
    </div>
  );
}
