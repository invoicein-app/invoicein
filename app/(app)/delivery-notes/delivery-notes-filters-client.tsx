"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function DeliveryNotesFiltersClient() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const qParam = sp.get("q") || "";
  const psParam = sp.get("ps") || "20";

  const [q, setQ] = useState(qParam);
  const [ps, setPs] = useState(psParam);

  useEffect(() => setQ(qParam), [qParam]);
  useEffect(() => setPs(psParam || "20"), [psParam]);

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
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      pushParams(next);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const next = new URLSearchParams(baseParams.toString());
    if (ps) next.set("ps", ps);
    else next.delete("ps");
    pushParams(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ps]);

  const labelStyle: React.CSSProperties = { fontSize: 12, color: "#666", marginBottom: 6 };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 10px",
    borderRadius: 10,
    border: "1px solid #ddd",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 260px", minWidth: 240 }}>
        <div style={labelStyle}>Cari nomor SJ / customer</div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari..."
          style={inputStyle}
        />
      </div>
      <div style={{ flex: "0 0 140px", minWidth: 130 }}>
        <div style={labelStyle}>Per halaman</div>
        <select
          value={ps}
          onChange={(e) => setPs(e.target.value)}
          style={{ ...inputStyle, background: "white" }}
        >
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="30">30</option>
          <option value="50">50</option>
        </select>
      </div>
      <button
        type="button"
        onClick={() => router.push(pathname)}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: "white",
          cursor: "pointer",
          fontWeight: 700,
          height: 40,
        }}
      >
        Reset
      </button>
    </div>
  );
}
