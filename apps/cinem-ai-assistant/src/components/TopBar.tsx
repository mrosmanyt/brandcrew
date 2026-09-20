import { Camera, LogOut, MonitorUp, Settings, Clapperboard, Users } from "lucide-react";
import { setCreatorOsOpen } from "@/components/creator/CreatorOsPanel";
import { openTeamHandoff } from "@/components/team/TeamHandoffPanel";
import { motion } from "framer-motion";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useVisionStore } from "@/store/useVisionStore";
import { useCinemCloudStore } from "@/store/useCinemCloudStore";
import { cn } from "@/lib/utils";

/** Camera / Screen vision toggle button with active state. */
function VisionToggle({ kind }: { kind: "camera" | "screen" }) {
  const mode = useVisionStore((s) => s.mode);
  const enableCamera = useVisionStore((s) => s.enableCamera);
  const enableScreen = useVisionStore((s) => s.enableScreen);
  const disable = useVisionStore((s) => s.disable);

  const active = mode === kind;
  const Icon = kind === "camera" ? Camera : MonitorUp;

  const toggle = () => {
    if (active) disable();
    else if (kind === "camera") void enableCamera().catch(() => undefined);
    else void enableScreen().catch(() => undefined);
  };

  return (
    <button
      onClick={toggle}
      className={cn(
        "glass flex size-8 items-center justify-center transition-colors",
        active ? "text-neon shadow-[0_0_12px_rgba(var(--glow),0.4)]" : "text-neon-dim hover:text-neon",
      )}
      aria-label={kind === "camera" ? "Toggle camera" : "Toggle screen share"}
      title={kind === "camera" ? "Enable Camera" : "Share Screen"}
    >
      <Icon className="size-4" />
    </button>
  );
}

/** Top bar: angular Cinem AI Assistant title plate (center) + utility icons (right). */
export default function TopBar() {
  const usage = useCinemCloudStore((s) => s.usage);
  const signOut = useCinemCloudStore((s) => s.signOut);
  const showUpgrade = useCinemCloudStore((s) => s.showUpgrade);

  return (
    <header className="relative flex h-16 shrink-0 items-center justify-between px-5">
      {/* Left: version tag + plan meter */}
      <div className="flex items-center gap-3 font-display text-[0.65rem] tracking-[0.25em] text-neon-dim">
        <span className="size-1.5 rounded-full bg-neon dot-active" />
        Cinem AI Assistant&nbsp;CORE&nbsp;v0.1
        {usage && (
          <button
            type="button"
            onClick={() => !usage.allowed && showUpgrade(usage)}
            className="tracking-[0.12em] text-neon-dim/90 hover:text-ice"
            title={
              usage.proRequired
                ? "Pro required"
                : usage.includedWithPlan || usage.pro
                  ? `${usage.planName} — included with this CINEM Pro account`
                  : "Free monthly turns"
            }
          >
            {usage.proRequired
              ? "PRO REQUIRED"
              : usage.includedWithPlan || usage.pro
                ? usage.planName.toUpperCase()
                : `${usage.planName.toUpperCase()} · ${usage.remaining} TURNS`}
          </button>
        )}
      </div>

      {/* Center: title plate with angled wings */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="absolute left-1/2 top-2 -translate-x-1/2"
      >
        <div className="flex items-center gap-3">
          <span className="h-px w-24 bg-gradient-to-l from-neon/70 to-transparent" />
          <div
            className="border border-neon/40 bg-panel/80 px-10 py-2 backdrop-blur"
            style={{
              clipPath:
                "polygon(16px 0, calc(100% - 16px) 0, 100% 100%, 0 100%)",
            }}
          >
            <h1 className="neon-text font-display text-xl font-black tracking-[0.45em]">
              Cinem AI Assistant
            </h1>
          </div>
          <span className="h-px w-24 bg-gradient-to-r from-neon/70 to-transparent" />
        </div>
        <p className="mt-1 text-center text-[0.6rem] tracking-[0.3em] text-neon-dim/80 uppercase">
          Personal Intelligent Cyber Assistant
        </p>
      </motion.div>

      {/* Right: vision controls + settings */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setCreatorOsOpen(true)}
          className="glass hidden h-8 items-center gap-1 px-2 text-[0.55rem] tracking-widest text-neon-dim hover:text-neon sm:flex"
          title="Creator OS"
        >
          <Clapperboard className="size-3.5" /> CREATOR
        </button>
        <button
          type="button"
          onClick={() => openTeamHandoff()}
          className="glass hidden h-8 items-center gap-1 px-2 text-[0.55rem] tracking-widest text-neon-dim hover:text-neon sm:flex"
          title="Team handoff"
        >
          <Users className="size-3.5" /> TEAM
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="glass flex size-8 items-center justify-center text-neon-dim transition-colors hover:text-neon"
          aria-label="Sign out of CINEM Pro"
          title="Sign out"
        >
          <LogOut className="size-4" />
        </button>
        <VisionToggle kind="camera" />
        <VisionToggle kind="screen" />
        <button
          onClick={() => useSettingsStore.getState().setOpen(true)}
          className="glass flex size-8 items-center justify-center text-neon-dim transition-colors hover:rotate-45 hover:text-neon"
          aria-label="Open settings"
          title="Settings"
        >
          <Settings className="size-4" />
        </button>
      </div>
    </header>
  );
}
