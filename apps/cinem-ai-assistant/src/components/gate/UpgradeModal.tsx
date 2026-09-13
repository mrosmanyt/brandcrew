import { Sparkles } from "lucide-react";
import { shouldPromptAssistantUpgrade } from "../../../usage-client";
import { openUpgrade } from "@/lib/cinemCloud";
import { useCinemCloudStore } from "@/store/useCinemCloudStore";

/**
 * Claude / Grok-style upgrade sheet. Opens the existing Pro checkout in the
 * system browser — never embeds a card form.
 */
export default function UpgradeModal() {
  const open = useCinemCloudStore((s) => s.upgradeOpen);
  const usage = useCinemCloudStore((s) => s.usage);
  const hide = useCinemCloudStore((s) => s.hideUpgrade);
  if (!open || !usage || !shouldPromptAssistantUpgrade(usage)) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-void/80 p-6 backdrop-blur-sm">
      <div className="glass w-[440px] max-w-[92vw] p-8">
        <div className="mb-4 flex size-12 items-center justify-center border border-neon/40 bg-neon/10">
          <Sparkles className="size-6 text-neon" />
        </div>
        <h2 className="font-display text-sm font-bold tracking-[0.25em] text-ice">
          UPGRADE TO KEEP GOING
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ice/80">
          You&apos;ve used {usage.used} of {usage.limit} Free chat/voice turns this month
          ({usage.period}). Cinem AI Assistant is included with Pro, Pro Plus, and Ultra —
          the same plans as the web desk.
        </p>
        <p className="mt-2 text-xs text-neon-dim">
          Checkout opens in your browser, already pointed at your CINEM Pro account.
        </p>
        <button
          onClick={() => void openUpgrade(usage.upgradeUrl)}
          className="mt-6 flex w-full items-center justify-center border border-neon/50 bg-neon/15 py-2.5 font-display text-[0.65rem] font-bold tracking-[0.25em] text-neon transition-all hover:bg-neon/25"
        >
          UPGRADE TO PRO
        </button>
        <button
          onClick={hide}
          className="mt-2 w-full py-2 font-display text-[0.55rem] tracking-[0.2em] text-neon-dim hover:text-ice"
        >
          NOT NOW
        </button>
      </div>
    </div>
  );
}
