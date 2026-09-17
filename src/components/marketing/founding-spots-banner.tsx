"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Spots = {
  total: number;
  claimed: number;
  remaining: number;
  open: boolean;
  message?: string;
};

export function FoundingSpotsBanner({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [spots, setSpots] = useState<Spots | null>(null);

  useEffect(() => {
    void fetch("/api/founding/spots")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.remaining === "number") setSpots(data as Spots);
      })
      .catch(() => undefined);
  }, []);

  if (!spots) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground",
        compact && "py-2 text-xs",
        className,
      )}
      role="status"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-amber-600" aria-hidden />
        {spots.open ? (
          <>
            <span>
              <strong>{spots.remaining}</strong> of <strong>{spots.total}</strong> founding spots
              left — Cinem AI Assistant free for early members.
            </span>
            <Link href="/signup" className="font-medium text-amber-800 underline-offset-2 hover:underline dark:text-amber-200">
              Claim yours
            </Link>
          </>
        ) : (
          <span>
            Founding spots are full. Cinem AI Assistant is included with Pro plans —{" "}
            <Link href="/billing?product=cinem-ai-assistant" className="font-medium underline-offset-2 hover:underline">
              upgrade
            </Link>
            .
          </span>
        )}
      </div>
    </div>
  );
}

export function FoundingMemberBadge({ number }: { number?: number | null }) {
  if (!number) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
      <Sparkles className="size-3" aria-hidden />
      Founding #{number}
    </span>
  );
}
