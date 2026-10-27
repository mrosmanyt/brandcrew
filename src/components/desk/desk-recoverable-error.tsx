"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

type DeskRecoverableErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
};

/** Recoverable desk shell error — never a silent white screen. */
export function DeskRecoverableError({
  error,
  reset,
  title = "Desk couldn't load",
  description = "The workspace failed to load. This is usually a temporary server or database issue — not a sign-out.",
}: DeskRecoverableErrorProps) {
  useEffect(() => {
    console.error("[desk] recoverable error", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CINEM Pro desk</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
        {process.env.NODE_ENV !== "production" && error.message ? (
          <p className="mt-4 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
            {error.message}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" onClick={() => reset()}>
            Reload
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (typeof window !== "undefined") window.location.assign("/desk");
            }}
          >
            Back to workspaces
          </Button>
        </div>
      </div>
    </div>
  );
}
