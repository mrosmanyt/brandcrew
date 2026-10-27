import { Brain, Mic2, Settings, Sparkles, Wrench } from "lucide-react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { cn } from "@/lib/utils";

type NavId = "memory" | "skills" | "voices" | "settings";

const NAV: { id: NavId; label: string; icon: typeof Brain; hint: string }[] = [
  { id: "memory", label: "Memory", icon: Brain, hint: "Settings → Memory" },
  { id: "skills", label: "Skills", icon: Wrench, hint: "Settings → Agents" },
  { id: "voices", label: "Voices", icon: Mic2, hint: "Settings → Voice" },
  { id: "settings", label: "Settings", icon: Settings, hint: "Settings" },
];

/** Minimal bottom nav — opens Settings (user picks tab inside modal). */
export default function AssistantNavShell() {
  const setOpen = useSettingsStore((s) => s.setOpen);

  const open = () => setOpen(true);

  return (
    <nav
      className="flex shrink-0 items-center justify-between gap-2 border-t border-white/5 bg-black/20 px-4 py-2"
      aria-label="Assistant navigation"
    >
      <div className="flex items-center gap-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={open}
              title={item.hint}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[0.6rem] font-semibold uppercase tracking-wider text-neon-dim transition-colors hover:bg-white/5 hover:text-neon",
              )}
            >
              <Icon className="size-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>
      <span
        className="flex items-center gap-1 rounded-full border border-neon/30 bg-neon/10 px-2.5 py-1 text-[0.55rem] font-bold uppercase tracking-wider text-neon"
        title="Active agent for desktop automation"
      >
        <Sparkles className="size-3" />
        Active: computer-use
      </span>
    </nav>
  );
}
