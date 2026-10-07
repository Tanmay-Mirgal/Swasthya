"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getSidebarCollapsed, setSidebarCollapsed } from "@/lib/preferences";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // The rail and the page around it are separate components, and a second tab can change the choice too.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * Whether the desktop sidebar is collapsed to icons. Open by default (`false`), remembered on this device, and shared
 * by every component that reads it, so the rail and the space beside it always agree. The server render is always
 * open; a collapsed choice is read straight after hydration.
 */
export function useSidebarCollapsed(): [collapsed: boolean, setCollapsed: (collapsed: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, getSidebarCollapsed, () => false);
  const set = useCallback((next: boolean) => {
    setSidebarCollapsed(next);
    listeners.forEach((l) => l());
  }, []);
  return [collapsed, set];
}
