"use client";

import { Loader2 } from "lucide-react";
import { jobWorkingLabel } from "@/lib/agent-modes";
import { cn } from "@/lib/utils";

export function JobStartingStatus({
  status,
  className,
}: {
  status: "queued" | "running";
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center gap-2 text-sm text-foreground", className)}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-3.5 shrink-0 text-chart-4 motion-safe:animate-spin" />
      <span className="desk-starting-shine font-medium">
        {jobWorkingLabel(status)}
      </span>
    </div>
  );
}
