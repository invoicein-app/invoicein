"use client";

import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/app/components/sidebar";

const STORAGE_KEY = "invoiceku-sidebar-collapsed";
const EXPANDED = 264;
const COLLAPSED = 80;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const colW = collapsed ? COLLAPSED : EXPANDED;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1600,
        margin: "0 auto",
        padding: "0 20px 28px",
        display: "grid",
        gridTemplateColumns: `${colW}px minmax(0, 1fr)`,
        gap: 0,
        alignItems: "start",
        boxSizing: "border-box",
        transition: "grid-template-columns 0.22s ease",
      }}
    >
      <Sidebar collapsed={collapsed} onToggleCollapse={toggle} />
      <main style={{ minWidth: 0, background: "#F8F9FA", minHeight: "calc(100vh - 56px)" }}>{children}</main>
    </div>
  );
}
