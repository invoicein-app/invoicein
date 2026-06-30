"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useNavProgressOptional } from "./nav-progress-context";

/** Router wrapper that shows global list/navigation loading feedback. */
export function useAppRouter() {
  const router = useRouter();
  const nav = useNavProgressOptional();
  const [isPending, startTransition] = useTransition();

  function push(href: string) {
    nav?.startNavigation(href);
    startTransition(() => {
      router.push(href);
    });
  }

  function replace(href: string) {
    nav?.startNavigation(href);
    startTransition(() => {
      router.replace(href);
    });
  }

  return {
    push,
    replace,
    refresh: () => router.refresh(),
    back: () => router.back(),
    isNavigating: Boolean(nav?.isNavigating || isPending),
  };
}
