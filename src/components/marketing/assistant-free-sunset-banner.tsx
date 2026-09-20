"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cinemAiAssistantBillingPath } from "@/lib/cinem-ai-assistant";
import {
  ASSISTANT_SUNSET_CTA,
  ASSISTANT_SUNSET_DATED_PREFIX,
  ASSISTANT_SUNSET_DATED_SUFFIX,
  ASSISTANT_SUNSET_GENERIC,
  assistantCutoffLabel,
} from "@/lib/assistant-sunset-copy";

type MeFlags = {
  assistantPro?: boolean;
  foundingMember?: boolean;
  assistantFoundingMember?: boolean;
  assistantSunsetBanner?: boolean;
  assistantCutoffAt?: string | null;
};

/**
 * Notice for legacy Free users. Hidden for Pro / founding once /api/auth/me loads.
 * When cutoff is unset, copy stays generic (no fabricated date).
 */
export function AssistantFreeSunsetBanner() {
  const [hidden, setHidden] = useState(false);
  const [cutoff, setCutoff] = useState<string | null>(null);

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

  const dateLabel = assistantCutoffLabel(cutoff);

  return (
    <div
      className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
      role="status"
    >
      {dateLabel ? (
        <>
          {ASSISTANT_SUNSET_DATED_PREFIX} <strong>{dateLabel}</strong>. {ASSISTANT_SUNSET_DATED_SUFFIX}{" "}
        </>
      ) : (
        <>{ASSISTANT_SUNSET_GENERIC} </>
      )}
      <Link href={cinemAiAssistantBillingPath("monthly")} className="font-medium underline underline-offset-2">
        {ASSISTANT_SUNSET_CTA}
      </Link>
      .
    </div>
  );
}
