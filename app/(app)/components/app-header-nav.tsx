"use client";

import AppNavLink from "@/app/components/app-nav-link";
import { APP_TEAL } from "./app-ui-tokens";

export { APP_TEAL, APP_BG, APP_BORDER } from "./app-ui-tokens";

export function appHeaderIconWrap(): React.CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "rgba(45, 125, 113, 0.12)",
    display: "grid",
    placeItems: "center",
    textDecoration: "none",
    border: "1px solid rgba(45, 125, 113, 0.22)",
  };
}

/** Ikon lonceng + profil kanan atas (dipakai di banyak halaman app). */
export default function AppHeaderNav() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <AppNavLink href="/settings/activity" title="Notifikasi / aktivitas" style={appHeaderIconWrap()}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={APP_TEAL} strokeWidth="1.8" aria-hidden>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </AppNavLink>
      <AppNavLink href="/settings" title="Profil & pengaturan" style={appHeaderIconWrap()}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={APP_TEAL} strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1" strokeLinecap="round" />
        </svg>
      </AppNavLink>
    </div>
  );
}
