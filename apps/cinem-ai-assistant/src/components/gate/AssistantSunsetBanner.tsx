import { shouldHardLockAssistant } from "../../../usage-client";
import { useCinemCloudStore } from "@/store/useCinemCloudStore";

/** 7-day notice for legacy Free users before the hard Pro gate. */
export default function AssistantSunsetBanner() {
  const usage = useCinemCloudStore((s) => s.usage);
  if (!usage?.sunsetBanner || shouldHardLockAssistant(usage) || usage.pro) return null;

  const cutoff = usage.cutoffAt
    ? new Date(usage.cutoffAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "27 Sep 2026";

  return (
    <div
      className="shrink-0 border-b border-amber-400/30 bg-amber-500/10 px-5 py-2 text-center text-[0.7rem] leading-5 text-amber-100"
      role="status"
    >
      Free assistant access ends {cutoff}. After that, Pro, a paid desk plan,
      founding membership, or remaining invite bonus months are required.
    </div>
  );
}
