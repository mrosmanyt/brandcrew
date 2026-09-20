/**
 * Shared Cinem AI Assistant sunset-banner copy.
 * Never invent a cutoff date when `ASSISTANT_FREE_CUTOFF_AT` / cutoffAt is unset.
 */

export const ASSISTANT_SUNSET_GENERIC =
  "Cinem AI Assistant is included with Pro — Free accounts need a Pro plan, a paid desk, or founding membership.";

export const ASSISTANT_SUNSET_DATED_PREFIX =
  "Free Cinem AI Assistant access for existing non-Pro accounts ends";

export const ASSISTANT_SUNSET_DATED_SUFFIX =
  "After that, Pro, a paid desk plan, or founding membership is required.";

export const ASSISTANT_SUNSET_CTA = "View Pro plans";

export function assistantCutoffLabel(iso?: string | null): string | null {
  if (!iso?.trim()) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Desktop (no link) — generic or dated notice plus CTA. */
export function assistantSunsetBannerText(iso?: string | null): string {
  const label = assistantCutoffLabel(iso);
  const body = label
    ? `${ASSISTANT_SUNSET_DATED_PREFIX} ${label}. ${ASSISTANT_SUNSET_DATED_SUFFIX}`
    : ASSISTANT_SUNSET_GENERIC;
  return `${body} ${ASSISTANT_SUNSET_CTA}.`;
}
