import { shouldHardLockAssistant } from "../../../usage-client";
import { useCinemCloudStore } from "@/store/useCinemCloudStore";

/** Matches `src/lib/assistant-sunset-copy.ts` — keep strings in sync. */
const ASSISTANT_SUNSET_GENERIC =
  "Cinem AI Assistant is included with Pro — Free accounts need a Pro plan, a paid desk, or founding membership.";
const ASSISTANT_SUNSET_DATED_PREFIX =
  "Free Cinem AI Assistant access for existing non-Pro accounts ends";
const ASSISTANT_SUNSET_DATED_SUFFIX =
  "After that, Pro, a paid desk plan, or founding membership is required.";
const ASSISTANT_SUNSET_CTA = "View Pro plans";

function cutoffLabel(iso?: string | null) {
  if (!iso?.trim()) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Notice for legacy Free users. Generic copy when usage.cutoffAt is unset. */
export default function AssistantSunsetBanner() {
  const usage = useCinemCloudStore((s) => s.usage);
  if (!usage?.sunsetBanner || shouldHardLockAssistant(usage) || usage.pro) return null;

  const dateLabel = cutoffLabel(usage.cutoffAt);

  return (
    <div
      className="shrink-0 border-b border-amber-400/30 bg-amber-500/10 px-5 py-2 text-center text-[0.7rem] leading-5 text-amber-100"
      role="status"
    >
      {dateLabel
        ? `${ASSISTANT_SUNSET_DATED_PREFIX} ${dateLabel}. ${ASSISTANT_SUNSET_DATED_SUFFIX} ${ASSISTANT_SUNSET_CTA}.`
        : `${ASSISTANT_SUNSET_GENERIC} ${ASSISTANT_SUNSET_CTA}.`}
    </div>
  );
}
