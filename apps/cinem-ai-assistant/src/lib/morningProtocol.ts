/**
 * Morning Protocol — Cinem AI Assistant's proactive daily briefing.
 *
 * At the configured time (Settings → General), and on demand
 * ("morning briefing"), Cinem AI Assistant composes and SPEAKS a short briefing:
 *   • greeting by name + time of day
 *   • top live headlines (news engine)
 *   • PC health snapshot (VICTOR's security_scan, desktop builds)
 *   • a nudge for the day's plan (ETHAN)
 * — in the user's detected language, with the orb animating while speaking.
 */
import { chatLLM } from "@/lib/llm";
import { fetchHeadlines } from "@/lib/news";
import { speakQueued } from "@/lib/announcer";
import { languageDirective } from "@/lib/language";
import { useAppStore } from "@/store/useAppStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useUserStore } from "@/store/useUserStore";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const LAST_RUN_KEY = "cinem-ai-assistant-morning-last";

function timeOfDay(): string {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

/** Composes + speaks the briefing. Returns the briefing text (for chat). */
export async function runMorningBriefing(): Promise<string> {
  const app = useAppStore.getState();
  const settings = useSettingsStore.getState();
  const userName = useUserStore.getState().user?.name?.split(" ")[0] ?? "Sir";

  /* gather ingredients (each best-effort) */
  let headlines = "";
  try {
    const heads = await fetchHeadlines(4);
    headlines = heads.map((h) => `- ${h.title} (${h.source})`).join("\n");
  } catch { /* feeds offline */ }

  let system = "";
  if (IS_TAURI) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const scan = (await invoke("security_scan")) as {
        mem_used_mb: number; mem_total_mb: number; uptime_hours: number; process_count: number;
      };
      system = `RAM ${Math.round((scan.mem_used_mb / scan.mem_total_mb) * 100)}% used, uptime ${scan.uptime_hours}h, ${scan.process_count} processes.`;
    } catch { /* scan unavailable */ }
  }

  /* compose (LLM, with a no-LLM fallback so it never fails silent) */
  const date = new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
  let briefing: string;
  try {
    briefing = (
      await chatLLM(
        `Compose Cinem AI Assistant's spoken ${timeOfDay()} briefing for ${userName}. Today is ${date}.
${headlines ? `TOP HEADLINES:\n${headlines}` : "No live headlines available."}
${system ? `SYSTEM STATUS: ${system}` : ""}

Rules: under 110 words, warm JARVIS tone, address them by name, summarize 2-3 headlines naturally,
mention system status in one short line if present, end by asking if they'd like you to plan the day.
Plain text only — it will be SPOKEN aloud.${languageDirective(app.language)}`,
        settings,
        { system: "You are Cinem AI Assistant, a personal intelligent cyber assistant. Confident, warm, concise.", temperature: 0.6, maxTokens: 400 },
      )
    ).trim();
  } catch {
    briefing =
      `Good ${timeOfDay()}, ${userName}. It's ${date}. ` +
      (system ? `Your system is healthy — ${system} ` : "") +
      (headlines ? "I have today's headlines ready in the sidebar. " : "") +
      "Shall I plan your day?";
  }

  app.addMessage({ role: "assistant", text: briefing });
  void speakQueued(briefing);
  return briefing;
}

/** Starts the scheduler — call once at app boot. Fires once per day at the
 *  configured time (checks every 30s; catches up if Cinem AI Assistant opens later). */
export function initMorningProtocol(): void {
  setInterval(() => {
    const s = useSettingsStore.getState();
    if (!s.morningEnabled || !s.loaded) return;

    const today = new Date().toDateString();
    if (localStorage.getItem(LAST_RUN_KEY) === today) return;

    const [hh, mm] = s.morningTime.split(":").map(Number);
    const now = new Date();
    const due = now.getHours() > hh || (now.getHours() === hh && now.getMinutes() >= (mm || 0));
    if (!due) return;

    localStorage.setItem(LAST_RUN_KEY, today);
    void runMorningBriefing();
  }, 30_000);
}
