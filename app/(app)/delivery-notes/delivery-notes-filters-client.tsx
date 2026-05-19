"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { APP_BORDER, APP_TEAL } from "../components/app-ui-tokens";

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

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 40px 12px 14px",
    borderRadius: 8,
    border: `1px solid ${APP_BORDER}`,
    outline: "none",
    boxSizing: "border-box",
    fontSize: 14,
    background: "#fff",
  };

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 280px", minWidth: 0, position: "relative" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nomor SJ / invoice / customer"
          style={inputStyle}
          aria-label="Cari surat jalan"
        />
        <span
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            color: "#94a3b8",
          }}
          aria-hidden
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      </div>

      <div style={{ flex: "0 0 140px", minWidth: 130 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase" }}>
          Per halaman
        </div>
        <select
          value={ps}
          onChange={(e) => setPs(e.target.value)}
          style={{
            ...inputStyle,
            padding: "10px 12px",
            cursor: "pointer",
            fontWeight: 700,
            color: "#333",
          }}
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
          padding: "10px 16px",
          borderRadius: 8,
          border: `2px solid ${APP_TEAL}`,
          background: "#fff",
          color: APP_TEAL,
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 14,
          height: 44,
        }}
      >
        Reset
      </button>
    </div>
  );
}
