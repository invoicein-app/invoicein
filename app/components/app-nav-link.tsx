"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useNavProgressOptional } from "./nav-progress-context";

type Props = ComponentProps<typeof Link>;

function hrefToString(href: Props["href"]): string {
  if (typeof href === "string") return href;
  if (typeof href === "object" && href !== null) {
    const path = "pathname" in href ? String(href.pathname || "") : "";
    if ("search" in href && href.search) {
      const search = String(href.search);
      return search.startsWith("?") ? `${path}${search}` : `${path}?${search}`;
    }
    if ("query" in href && href.query && typeof href.query === "object") {
      const q = new URLSearchParams(href.query as Record<string, string>).toString();
      return q ? `${path}?${q}` : path;
    }
    return path;
  }
  return "";
}

/** Next.js Link that triggers global nav loading feedback on click. */
export default function AppNavLink({ href, onClick, ...rest }: Props) {
  const nav = useNavProgressOptional();
  const hrefStr = hrefToString(href);

  return (
    <Link
      href={href}
      onClick={(e) => {
        if (!e.defaultPrevented && hrefStr && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
          nav?.startNavigation(hrefStr);
        }
        onClick?.(e);
      }}
      {...rest}
    />
  );
}
