"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cinemAiAssistantBillingPath } from "@/lib/cinem-ai-assistant";

/** Mirrors `ASSISTANT_FREE_CUTOFF_AT` — do not import the server helper from client. */
const DEFAULT_CUTOFF = "2026-09-27T18:40:00.000Z";

type MeFlags = {
  assistantPro?: boolean;
  foundingMember?: boolean;
  assistantFoundingMember?: boolean;
  assistantSunsetBanner?: boolean;
  assistantCutoffAt?: string;
};

function cutoffLabel(iso?: string) {
  const date = new Date(iso || DEFAULT_CUTOFF);
  if (Number.isNaN(date.getTime())) return "27 Sep 2026";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * 7-day notice for legacy Free users. Hidden for Pro / founding once /api/auth/me loads.
 */
export function AssistantFreeSunsetBanner() {
  const [hidden, setHidden] = useState(false);
  const [cutoff, setCutoff] = useState(DEFAULT_CUTOFF);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { user?: { assistantFoundingMember?: boolean } | null } & MeFlags) => {
        if (cancelled) return;
        const pro = Boolean(data.assistantPro || data.foundingMember || data.user?.assistantFoundingMember);
        if (pro) setHidden(true);
        if (data.assistantCutoffAt) setCutoff(data.assistantCutoffAt);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
      role="status"
    >
      Free Cinem AI Assistant access for existing non-Pro accounts ends{" "}
      <strong>{cutoffLabel(cutoff)}</strong>. After that, Pro, a paid desk plan, or founding
      membership is required.{" "}
      <Link href={cinemAiAssistantBillingPath("monthly")} className="font-medium underline underline-offset-2">
        View Pro plans
      </Link>
      .
    </div>
  );
}
