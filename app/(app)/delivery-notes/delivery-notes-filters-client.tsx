"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { APP_BORDER, APP_TEAL } from "../components/app-ui-tokens";
import { useAppRouter } from "@/app/components/use-app-router";

export default function DeliveryNotesFiltersClient() {
  const router = useAppRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const qParam = sp.get("q") || "";

  const [q, setQ] = useState(qParam);

  useEffect(() => setQ(qParam), [qParam]);

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

  const controlHeight = 44;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: controlHeight,
    padding: "0 40px 0 14px",
    borderRadius: 8,
    border: `1px solid ${APP_BORDER}`,
    outline: "none",
    boxSizing: "border-box",
    fontSize: 14,
    background: "#fff",
  };

  return (
    <div className="app-filter-bar" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div className="app-filter-bar__search" style={{ flex: "1 1 280px", minWidth: 0, position: "relative" }}>
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

      <button
        type="button"
        onClick={() => router.push(pathname)}
        style={{
          padding: "0 16px",
          borderRadius: 8,
          border: `2px solid ${APP_TEAL}`,
          background: "#fff",
          color: APP_TEAL,
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 14,
          height: controlHeight,
          boxSizing: "border-box",
        }}
      >
        Reset
      </button>
    </div>
  );
}
