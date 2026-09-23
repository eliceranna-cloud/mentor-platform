"use client";

import { useSyncExternalStore } from "react";

/**
 * Live result of a CSS media query. Returns false during server rendering,
 * so prefer CSS breakpoints for layout and use this only for defaults.
 */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
