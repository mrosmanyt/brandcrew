"use client";

import { DeskRecoverableError } from "@/components/desk/desk-recoverable-error";

export default function DeskError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DeskRecoverableError error={error} reset={reset} />;
}
