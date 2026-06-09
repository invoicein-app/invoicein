"use client";

import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";

/**
 * Anti-double-submit guard for forms that already use `saving` / `loading` useState.
 *
 * Usage:
 *   const { tryBegin, end, isBlocked } = useSubmitGuard(setSaving);
 *   async function save() {
 *     if (isBlocked()) return;
 *     // ...validation...
 *     if (!tryBegin()) return;
 *     try { ... } finally { end(); }
 *   }
 */
export function useSubmitGuard(setBusy: Dispatch<SetStateAction<boolean>>) {
  const ref = useRef(false);

  const isBlocked = useCallback(() => ref.current, []);

  const tryBegin = useCallback((): boolean => {
    if (ref.current) return false;
    ref.current = true;
    setBusy(true);
    return true;
  }, [setBusy]);

  const end = useCallback(() => {
    ref.current = false;
    setBusy(false);
  }, [setBusy]);

  return { tryBegin, end, isBlocked };
}
