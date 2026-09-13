import { useState } from "react";
import { Globe2, ExternalLink, Loader2 } from "lucide-react";
import GlassPanel from "@/components/GlassPanel";

import { openExternal as openSystemBrowser } from "@/lib/desktop-shell";

const URL = "https://www.worldmonitor.app/";

/** Opens World Monitor in the system browser (fallback if embedding is blocked). */
async function openExternal() {
  await openSystemBrowser(URL);
}

/**
 * Center view — embedded https://www.worldmonitor.app/ (open-source world
 * news / trends / monitoring dashboard) inside Cinem AI Assistant.
 */
export default function WorldMonitor() {
  const [loaded, setLoaded] = useState(false);

  return (
    <GlassPanel
      title="World Monitor — Live"
      actions={
        <button
          onClick={() => void openExternal()}
          className="pointer-events-auto flex items-center gap-1.5 text-[0.62rem] tracking-[0.15em] text-neon-dim transition-colors hover:text-neon"
          title="Open in browser"
        >
          OPEN&nbsp;EXTERNAL <ExternalLink className="size-3.5" />
        </button>
      }
      className="flex-1"
      bodyClassName="relative overflow-hidden p-0"
    >
      {/* Loading veil until the iframe paints */}
      {!loaded && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-abyss/80">
          <Globe2 className="size-10 text-neon/70" />
          <div className="flex items-center gap-2 font-display text-[0.65rem] tracking-[0.25em] text-neon-dim">
            <Loader2 className="size-4 animate-spin" /> ESTABLISHING&nbsp;UPLINK…
          </div>
          <p className="max-w-72 text-center text-xs text-neon-dim/70">
            If the feed doesn't appear, the site may block embedding — use
            OPEN&nbsp;EXTERNAL above.
          </p>
        </div>
      )}

      <iframe
        src={URL}
        title="World Monitor"
        onLoad={() => setLoaded(true)}
        className="h-full w-full border-0 bg-[#0a0a0a]"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        referrerPolicy="no-referrer"
      />
    </GlassPanel>
  );
}
