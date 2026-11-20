"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js (public/) in production only. Dev keeps the browser's
 * default behavior so hot reloads are never served stale from the cache.
 * Registration failures are non-fatal: the site works identically without
 * the worker, it just is not installable-offline yet.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability is progressive enhancement; never surface this.
    });
  }, []);
  return null;
}
