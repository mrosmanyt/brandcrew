"use client";

import { useEffect } from "react";
import { DeskRecoverableError } from "@/components/desk/desk-recoverable-error";
import {
  isChunkLoadError,
  recoverFromChunkErrorOnce,
} from "@/lib/chunk-recovery";

/** Last-resort recoverable UI when the root layout throws. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // A stale-build chunk failure inside the root layout itself lands
    // here; one hard reload fetches the current build and usually
    // clears it. Guarded, so a genuinely broken deploy still ends on
    // this screen instead of looping.
    if (isChunkLoadError(error)) {
      recoverFromChunkErrorOnce();
    }
  }, [error]);

  return (
    <html lang="en">
      <body>
        <DeskRecoverableError
          error={error}
          reset={reset}
          title="This page couldn't load"
          description="Something went wrong loading CINEM Pro. Reload to try again."
        />
      </body>
    </html>
  );
}
