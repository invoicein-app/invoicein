"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
  const psParam = sp.get("ps") || "";

  const [inv, setInv] = useState(invParam);
  const [custId, setCustId] = useState(custIdParam);
  const [pay, setPay] = useState(payParam);
  const [from, setFrom] = useState(fromParam);
  const [to, setTo] = useState(toParam);
  const [ps, setPs] = useState(psParam || "20");

  // sync state (back/forward)
  useEffect(() => setInv(invParam), [invParam]);
  useEffect(() => setCustId(custIdParam), [custIdParam]);
  useEffect(() => setPay(payParam), [payParam]);
  useEffect(() => setFrom(fromParam), [fromParam]);
  useEffect(() => setTo(toParam), [toParam]);
  useEffect(() => setPs(psParam || "20"), [psParam]);

  const baseParams = useMemo(() => {
    const p = new URLSearchParams(sp.toString());
    p.set("p", "1"); // reset page when filter changes
    return p;
  }, [sp]);

  function pushParams(next: URLSearchParams) {
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  // Debounce invoice search
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

  // Instant apply for dropdown/date/page size
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

    if (ps) next.set("ps", ps);
    else next.delete("ps");

    pushParams(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custId, pay, from, to, ps]);

  function resetAll() {
    router.push(pathname);
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: "#666",
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 10px",
    borderRadius: 10,
    border: "1px solid #ddd",
    outline: "none",
    boxSizing: "border-box",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    background: "white",
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-end",
        flexWrap: "wrap", // ✅ biar nggak nabrak
      }}
    >
      {/* Invoice No search */}
      <div style={{ flex: "1 1 260px", minWidth: 240 }}>
        <div style={labelStyle}>Invoice No</div>
        <input
          value={inv}
          onChange={(e) => setInv(e.target.value)}
          placeholder="Cari invoice (debounce)..."
          style={inputStyle}
        />
      </div>

      {/* Customer dropdown */}
      <div style={{ flex: "1 1 280px", minWidth: 260 }}>
        <div style={labelStyle}>Pelanggan</div>
        <select
          value={custId}
          onChange={(e) => setCustId(e.target.value)}
          style={selectStyle}
        >
          <option value="">Semua pelanggan</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Pay status */}
      <div style={{ flex: "0 0 170px", minWidth: 160 }}>
        <div style={labelStyle}>Status</div>
        <select
          value={pay}
          onChange={(e) => setPay(e.target.value)}
          style={selectStyle}
        >
          <option value="">Semua</option>
          <option value="UNPAID">UNPAID</option>
          <option value="PARTIAL">PARTIAL</option>
          <option value="PAID">PAID</option>
        </select>
      </div>

      {/* Per Page */}
      <div style={{ flex: "0 0 140px", minWidth: 130 }}>
        <div style={labelStyle}>Per Page</div>
        <select
          value={ps}
          onChange={(e) => setPs(e.target.value)}
          style={selectStyle}
        >
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="30">30</option>
          <option value="50">50</option>
        </select>
      </div>

      {/* Reset */}
      <button
        onClick={resetAll}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: "white",
          cursor: "pointer",
          fontWeight: 700,
          height: 40,
          flex: "0 0 auto",
        }}
      >
        Reset
      </button>

      {/* Date filters */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          flexWrap: "wrap",
          width: "100%",
          marginTop: 4,
        }}
      >
        <div style={{ flex: "0 0 auto" }}>
          <div style={labelStyle}>Tanggal</div>
          <div style={{ height: 40, display: "flex", alignItems: "center", color: "#999" }}>
            (opsional)
          </div>
        </div>

        <div style={{ flex: "0 0 180px", minWidth: 160 }}>
          <div style={labelStyle}>Dari</div>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ flex: "0 0 180px", minWidth: 160 }}>
          <div style={labelStyle}>Sampai</div>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );
}