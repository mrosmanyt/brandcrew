import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import {
  ASSISTANT_SALES_WHATSAPP_URL,
  shouldHardLockAssistant,
} from "../../../usage-client";
import { openUpgrade } from "@/lib/cinemCloud";
import { openExternal } from "@/lib/desktop-shell";
import { useCinemCloudStore } from "@/store/useCinemCloudStore";

/**
 * Hard Pro lock. Cannot be dismissed. Payment check / Refresh re-fetches
 * usage from the server. Local BYOK does not bypass this overlay.
 */
export default function AssistantProLock() {
  const usage = useCinemCloudStore((s) => s.usage);
  const error = useCinemCloudStore((s) => s.error);
  const refreshUsage = useCinemCloudStore((s) => s.refreshUsage);
  const [busy, setBusy] = useState(false);

  if (!shouldHardLockAssistant(usage)) return null;

  const whatsapp = usage?.whatsappUrl || ASSISTANT_SALES_WHATSAPP_URL;

  async function onRefresh() {
    setBusy(true);
    try {
      await refreshUsage();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-void/90 p-6 backdrop-blur-sm">
      <div className="glass w-[460px] max-w-[92vw] p-8">
        <div className="mb-4 flex size-12 items-center justify-center border border-neon/40 bg-neon/10">
          <Sparkles className="size-6 text-neon" />
        </div>
        <h2 className="font-display text-sm font-bold tracking-[0.25em] text-ice">
          PRO REQUIRED
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ice/80">
          Cinem AI Assistant is included with Pro, Pro Plus, Ultra, an active
          assistant subscription, or a founding membership. This lock cannot be
          dismissed.
        </p>
        <p className="mt-2 text-xs text-neon-dim">
          Checkout opens in your browser. After you pay, use Payment check /
          Refresh — we re-fetch entitlement from the server.
        </p>
        <button
          onClick={() => void openUpgrade(usage?.upgradeUrl)}
          className="mt-6 flex w-full items-center justify-center border border-neon/50 bg-neon/15 py-2.5 font-display text-[0.65rem] font-bold tracking-[0.25em] text-neon transition-all hover:bg-neon/25"
        >
          UPGRADE TO PRO
        </button>
        <button
          onClick={() => void openExternal(whatsapp)}
          className="mt-2 flex w-full items-center justify-center border border-neon/30 py-2.5 font-display text-[0.6rem] font-bold tracking-[0.2em] text-ice transition-colors hover:bg-neon/10"
        >
          WHATSAPP SALES
        </button>
        <button
          onClick={() => void onRefresh()}
          disabled={busy}
          className="mt-2 flex w-full items-center justify-center gap-2 border border-neon/30 py-2.5 font-display text-[0.6rem] font-bold tracking-[0.2em] text-ice transition-colors hover:bg-neon/10 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          PAYMENT CHECK / REFRESH
        </button>
        {error ? <p className="mt-3 text-xs text-amber-300">{error}</p> : null}
      </div>
    </div>
  );
}
