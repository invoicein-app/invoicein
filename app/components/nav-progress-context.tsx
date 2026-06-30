"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

type NavProgressContextValue = {
  startNavigation: (href: string) => void;
  isNavigating: boolean;
};

const NavProgressContext = createContext<NavProgressContextValue | null>(null);

/** Normalize href for comparison (pathname + sorted query, no hash). */
export function normalizeComparableHref(href: string): string {
  const raw = String(href || "").trim() || "/";
  try {
    const url = raw.startsWith("http://") || raw.startsWith("https://")
      ? new URL(raw)
      : new URL(raw.startsWith("/") ? raw : `/${raw}`, "http://local");
    const params = new URLSearchParams(url.searchParams);
    const q = params.toString();
    return `${url.pathname}${q ? `?${q}` : ""}`;
  } catch {
    return raw.split("#")[0];
  }
}

export function NavProgressProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<NavProgressContext.Provider value={null}>{children}</NavProgressContext.Provider>}>
      <NavProgressProviderInner>{children}</NavProgressProviderInner>
    </Suspense>
  );
}

function NavProgressProviderInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const currentHref = useMemo(() => {
    const q = searchParams.toString();
    return q ? `${pathname}?${q}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    setPendingHref(null);
  }, [currentHref]);

  useEffect(() => {
    if (!pendingHref) return;
    const timer = window.setTimeout(() => setPendingHref(null), 15000);
    return () => window.clearTimeout(timer);
  }, [pendingHref]);

  const startNavigation = useCallback(
    (href: string) => {
      if (normalizeComparableHref(currentHref) === normalizeComparableHref(href)) return;
      setPendingHref(href);
    },
    [currentHref]
  );

  const value: NavProgressContextValue = {
    startNavigation,
    isNavigating: pendingHref !== null,
  };

  return <NavProgressContext.Provider value={value}>{children}</NavProgressContext.Provider>;
}

export function useNavProgress() {
  const ctx = useContext(NavProgressContext);
  if (!ctx) {
    throw new Error("useNavProgress must be used within NavProgressProvider");
  }
  return ctx;
}

export function useNavProgressOptional() {
  return useContext(NavProgressContext);
}

function NavSpinner({ color = "#1E7F75", size = 36 }: { color?: string; size?: number }) {
  return (
    <svg
      className="form-submit-spinner"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeOpacity="0.22"
      />
      <path fill={color} d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z" />
    </svg>
  );
}

/** Loading overlay for the right-side main content panel only. */
export function NavContentLoadingOverlay() {
  return (
    <div className="nav-content-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="nav-content-loading__panel">
        <NavSpinner />
        <div className="nav-content-loading__title">Sedang memuat...</div>
        <div className="nav-content-loading__sub">Mohon tunggu...</div>
      </div>
    </div>
  );
}
