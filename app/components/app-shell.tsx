"use client";

import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/app/components/sidebar";
import { NavContentLoadingOverlay, NavProgressProvider, useNavProgressOptional } from "@/app/components/nav-progress-context";

const STORAGE_KEY = "invoiceku-sidebar-collapsed";
const MOBILE_MAX = 768;

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <NavProgressProvider>
      <AppShellInner>{children}</AppShellInner>
    </NavProgressProvider>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const nav = useNavProgressOptional();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const sync = () => {
      const mobile = mq.matches;
      setIsMobile(mobile);
      if (!mobile) setMobileNavOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

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

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  return (
    <>
      {mobileNavOpen ? (
        <button
          type="button"
          className="app-sidebar-backdrop"
          aria-label="Tutup menu"
          onClick={closeMobileNav}
        />
      ) : null}

      <button
        type="button"
        className="app-mobile-menu-fab"
        aria-expanded={mobileNavOpen}
        aria-label={mobileNavOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
        onClick={() => setMobileNavOpen((o) => !o)}
      >
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
        <span>Menu</span>
      </button>

      <div className={`app-shell${collapsed ? " app-shell--collapsed" : ""}`}>
        <div className="app-sidebar-layer">
          <Sidebar
            collapsed={isMobile ? false : collapsed}
            onToggleCollapse={toggle}
            mobileOpen={mobileNavOpen}
            onCloseMobile={closeMobileNav}
          />
        </div>
        <main className="app-shell-main">
          <div
            className={`app-shell-main__inner${nav?.isNavigating ? " app-shell-main__inner--loading" : ""}`}
          >
            {children}
          </div>
          {nav?.isNavigating ? <NavContentLoadingOverlay /> : null}
        </main>
      </div>
    </>
  );
}
