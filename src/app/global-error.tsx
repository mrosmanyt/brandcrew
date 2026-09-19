"use client";

import { DeskRecoverableError } from "@/components/desk/desk-recoverable-error";

/** Last-resort recoverable UI when the root layout throws. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
