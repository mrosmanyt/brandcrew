/**
 * Session briefing — lightweight proactive greeting when opening the assistant.
 * Distinct from the scheduled Morning Protocol (morningProtocol.ts).
 */
import { fetchHeadlines } from "@/lib/news";
import { speakQueued } from "@/lib/announcer";
import { useAppStore } from "@/store/useAppStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useUserStore } from "@/store/useUserStore";
import { listReminders } from "@/lib/reminders";

const SESSION_KEY = "cinem-ai-assistant-session-briefed";

function timeOfDay(): string {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

/** Runs once per browser/Electron session when enabled in Settings. */
export async function runSessionBriefing(): Promise<void> {
  if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SESSION_KEY)) return;

  const settings = useSettingsStore.getState();
  if (!settings.sessionBriefingEnabled || !settings.loaded) return;

  const userName = useUserStore.getState().user?.name?.split(" ")[0] ?? "Sir";
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

  let headlineLine = "";
  try {
    const heads = await fetchHeadlines(2);
    if (heads.length) headlineLine = ` Top story: ${heads[0].title}.`;
  } catch {
    /* offline */
  }

  const reminders = await listReminders();
  const reminderLine = reminders.length
    ? ` You have ${reminders.length} reminder${reminders.length > 1 ? "s" : ""} queued.`
    : "";

  const text =
    `Good ${timeOfDay()}, ${userName}. It's ${timeStr} on ${dateStr}. ` +
    `Cinem AI Assistant is online — voice, search, weather, and reminders are ready.${headlineLine}${reminderLine}`;

  useAppStore.getState().addMessage({ role: "assistant", text });
  void speakQueued(text);

  if (typeof sessionStorage !== "undefined") sessionStorage.setItem(SESSION_KEY, "1");
}

export function initSessionBriefing(): void {
  const tryRun = () => {
    const s = useSettingsStore.getState();
    if (!s.loaded) return;
    void runSessionBriefing();
  };
  tryRun();
  const unsub = useSettingsStore.subscribe((state, prev) => {
    if (!prev.loaded && state.loaded) tryRun();
  });
  setTimeout(tryRun, 2500);
  return unsub as unknown as void;
}
