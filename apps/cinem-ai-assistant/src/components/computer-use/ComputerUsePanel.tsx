import { useEffect } from "react";
import { OctagonX, Shield, Terminal } from "lucide-react";
import { useComputerUseStore } from "@/store/useComputerUseStore";
import { isComputerUseEnabled, setComputerUseLocalEnabled } from "@/lib/computer-use/feature";
import { sessionStatusLabel } from "@/lib/computer-use/runner";
import { cinemDesktopBridge, isCinemElectron } from "@/lib/desktop-shell";
import { cn } from "@/lib/utils";

/** Supervised computer-use controls — TERMINATE + shell confirm. */
export default function ComputerUsePanel() {
  const session = useComputerUseStore((s) => s.session);
  const pendingShell = useComputerUseStore((s) => s.pendingShell);
  const envEnabled = useComputerUseStore((s) => s.envEnabled);
  const terminate = useComputerUseStore((s) => s.terminate);
  const confirmShell = useComputerUseStore((s) => s.confirmShellAndResume);
  const setEnvEnabled = useComputerUseStore((s) => s.setEnvEnabled);

  useEffect(() => {
    const bridge = cinemDesktopBridge();
    if (bridge?.computerUse?.envEnabled) {
      void bridge.computerUse.envEnabled().then((on) => setEnvEnabled(Boolean(on)));
    }
  }, [setEnvEnabled]);

  const enabled = isComputerUseEnabled({ envEnabled });
  if (!enabled && !isCinemElectron()) return null;

  const status = session?.status ?? "idle";

  return (
    <div className="glass flex flex-col gap-2 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-neon" />
          <span className="font-display text-[0.65rem] font-bold tracking-[0.15em] text-ice/90">
            COMPUTER USE
          </span>
        </div>
        <span
          className={cn(
            "rounded px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider",
            status === "working" && "bg-neon/20 text-neon",
            status === "paused" && "bg-amber-500/20 text-amber-300",
            status === "terminated" && "bg-red-500/20 text-red-400",
            status === "idle" && "bg-white/5 text-neon-dim",
          )}
        >
          {sessionStatusLabel(status)}
        </span>
      </div>

      {session && (
        <p className="text-xs text-ice/70 line-clamp-2">
          {session.currentAction || session.task}
        </p>
      )}
      {session && (
        <p className="text-[0.65rem] text-neon-dim">
          Step {session.step} of {session.maxSteps}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => terminate()}
          disabled={!session || status === "terminated"}
          className="flex items-center gap-1.5 rounded bg-red-600/90 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-white hover:bg-red-500 disabled:opacity-40"
        >
          <OctagonX className="size-3.5" />
          Terminate
        </button>
        {pendingShell && (
          <button
            type="button"
            onClick={() => confirmShell()}
            className="flex items-center gap-1.5 rounded border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-amber-200 hover:bg-amber-500/20"
          >
            <Terminal className="size-3.5" />
            Allow PowerShell
          </button>
        )}
      </div>

      {!enabled && isCinemElectron() && (
        <label className="flex items-center gap-2 text-[0.65rem] text-neon-dim">
          <input
            type="checkbox"
            onChange={(e) => {
              setComputerUseLocalEnabled(e.target.checked);
              window.location.reload();
            }}
          />
          Enable dev flag (local)
        </label>
      )}

      <p className="text-[0.6rem] leading-relaxed text-neon-dim/80">
        Kill switch: red Terminate, Ctrl+Alt+Esc, or move mouse while Working (pauses; does not
        terminate). Distinct AI cursor is not available on Windows — HUD shows AI DRIVING.
      </p>
    </div>
  );
}
