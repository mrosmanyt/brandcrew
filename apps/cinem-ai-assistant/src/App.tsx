import { useEffect } from "react";
import TopBar from "@/components/TopBar";
import SettingsModal from "@/components/settings/SettingsModal";
import Toasts from "@/components/Toasts";
import TaskWindows from "@/components/TaskWindows";
import BootSequence from "@/components/BootSequence";
import CommandPalette from "@/components/CommandPalette";
import VisionPanel from "@/components/vision/VisionPanel";
import NovaPanel from "@/components/nova/NovaPanel";
import UploadPanel from "@/components/upload/UploadPanel";
import ThumbnailPanel from "@/components/thumbnails/ThumbnailPanel";
import ScriptPanel from "@/components/script/ScriptPanel";
import GrokPanel from "@/components/grok/GrokPanel";
import AutopilotPanel from "@/components/autopilot/AutopilotPanel";
import { initMorningProtocol } from "@/lib/morningProtocol";
import { loadCustomAgents } from "@/lib/customAgents";
import { useSettingsStore } from "@/store/useSettingsStore";
import MediaLink from "@/components/sidebar/MediaLink";
import SatLinkFeed from "@/components/sidebar/SatLinkFeed";
import TodayHeadlines from "@/components/sidebar/TodayHeadlines";
import IntelligenceHub from "@/components/center/IntelligenceHub";
import WorldMonitor from "@/components/center/WorldMonitor";
import CinemAiAssistantPlayer from "@/components/center/CinemAiAssistantPlayer";
import RiskRadar from "@/components/RiskRadar";
import { useAppStore, type CenterView } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import ChatPanel from "@/components/right/ChatPanel";
import SubAgentsPanel from "@/components/right/SubAgentsPanel";
import VoiceCommandBar from "@/components/VoiceCommandBar";

/** Center view switcher — HUB ⇄ WORLD ⇄ PLAYER ⇄ RISK RADAR. */
function CenterTabs() {
  const view = useAppStore((s) => s.centerView);
  const setView = useAppStore((s) => s.setCenterView);
  const showRadar = useSettingsStore((s) => s.showRadar);

  const tabs: { id: CenterView; label: string }[] = [
    { id: "hub", label: "INTELLIGENCE HUB" },
    { id: "world", label: "WORLD MONITOR" },
    { id: "player", label: "Cinem AI Assistant PLAYER" },
    ...(showRadar ? [{ id: "radar" as CenterView, label: "RISK RADAR" }] : []),
  ];

  return (
    <nav className="flex shrink-0 justify-center gap-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setView(t.id)}
          className={cn(
            "glass px-5 py-1.5 font-display text-[0.6rem] font-bold tracking-[0.2em] transition-colors",
            view === t.id ? "text-neon" : "text-neon-dim hover:text-ice",
          )}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

/**
 * Cinem AI Assistant — main layout (matches the reference image):
 * ┌──────────────────── TopBar: Cinem AI Assistant ────────────────────┐
 * │ Media Link   │  Connected nodes        │  Chat          │
 * │ SAT-LINK     │  Visual Intelligence    │  SUB AGENTS    │
 * │ Headlines    │  Hub (Three.js orb)     │  (15 agents)   │
 * ├──────────────── Voice waveform command bar ────────────┤
 */
export default function App() {
  const centerView = useAppStore((s) => s.centerView);
  const showRadar = useSettingsStore((s) => s.showRadar);

  // If the radar tab is open when its setting is switched off, fall back.
  useEffect(() => {
    if (centerView === "radar" && !showRadar) {
      useAppStore.getState().setCenterView("hub");
    }
  }, [centerView, showRadar]);

  // Load persisted settings (API keys, voice config, agent toggles) on boot
  useEffect(() => {
    loadCustomAgents(); // user-built agents FIRST, so saved statuses apply
    void useSettingsStore.getState().init();
    initMorningProtocol(); // daily briefing scheduler
    // Belt-and-suspenders: make sure the Node sidecars (media-server 7880,
    // playwright-server 7878) are running, in case the Rust boot-spawn missed.
    void import("@/lib/sidecars").then((m) => m.startSidecars());
    // Resume any 30-day Auto-Pilot campaign + arm the daily scheduler.
    void import("@/store/useAutopilotStore").then((m) => m.useAutopilotStore.getState()._load());
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <TopBar />

      <main className="grid min-h-0 flex-1 grid-cols-[290px_minmax(0,1fr)_400px] gap-4 px-4 pb-3 pt-2">
        {/* Left sidebar */}
        <aside className="flex min-h-0 flex-col gap-4">
          <MediaLink />
          <SatLinkFeed />
          <TodayHeadlines />
        </aside>

        {/* Center column — view switcher: Intelligence Hub ⇄ World Monitor */}
        <section className="flex min-h-0 flex-col gap-2">
          <CenterTabs />
          {/* Hub stays mounted (Three.js context) — World Monitor overlays it */}
          <div className={cn("min-h-0 flex-1 flex-col gap-4", centerView === "hub" ? "flex" : "hidden")}>
            <IntelligenceHub />
          </div>
          {centerView === "world" && <WorldMonitor />}
          {/* Radar mounts only while its tab is open (scans pause otherwise) */}
          {centerView === "radar" && <RiskRadar />}
          {/* Player stays mounted so audio keeps playing on other tabs */}
          <div className={cn("min-h-0 flex-1 flex-col", centerView === "player" ? "flex" : "hidden")}>
            <CinemAiAssistantPlayer />
          </div>
        </section>

        {/* Right column */}
        <aside className="flex min-h-0 flex-col gap-4">
          <ChatPanel />
          <SubAgentsPanel />
        </aside>
      </main>

      <VoiceCommandBar />

      {/* Overlays */}
      <SettingsModal />
      <VisionPanel />
      <NovaPanel />
      <UploadPanel />
      <ThumbnailPanel />
      <ScriptPanel />
      <GrokPanel />
      <AutopilotPanel />
      <TaskWindows />
      <CommandPalette />
      <Toasts />
      <BootSequence />
    </div>
  );
}
