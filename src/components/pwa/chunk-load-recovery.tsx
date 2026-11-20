"use client";

import { useEffect } from "react";
import {
  isChunkLoadError,
  recoverFromChunkErrorOnce,
} from "@/lib/chunk-recovery";

/**
 * Global safety net for stale-build chunk failures. When a JS chunk from a
 * previous deployment fails to load — common right after a new deploy, in
 * an already-open tab or the installed PWA — reload the page once so it
 * picks up the current build instead of dying on the error screen.
 * Errors that are not chunk-load failures are ignored here; the error
 * boundaries handle them.
 */
export function ChunkLoadRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
        recoverFromChunkErrorOnce();
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        recoverFromChunkErrorOnce();
      }
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
