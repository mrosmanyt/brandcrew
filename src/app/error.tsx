"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  isChunkLoadError,
  recoverFromChunkErrorOnce,
} from "@/lib/chunk-recovery";

/**
 * Root segment error boundary. Before this existed, every uncaught error
 * outside /desk fell through to global-error.tsx and tore down the whole
 * app; this boundary keeps the shell mounted and offers an in-place retry.
 * Stale-build chunk failures (the classic post-deploy "page couldn't
 * load") recover automatically with a one-time full reload.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] recoverable error", error);
    if (isChunkLoadError(error)) {
      recoverFromChunkErrorOnce();
    }
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          CINEM Pro
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          This page couldn&apos;t load
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Something went wrong loading CINEM Pro. This is usually temporary —
          try again, or reload the page if it keeps happening.
        </p>
        {process.env.NODE_ENV !== "production" && error.message ? (
          <p className="mt-4 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
            {error.message}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
          >
            Reload page
          </Button>
        </div>
      </div>
    </div>
  );
}
