/**
 * Cinem AI Assistant Agent Announcer — JARVIS-style activation announcements.
 *
 * Every agent activation first SPEAKS, in that agent's own voice:
 *     "[CODENAME] — [Agent Name] is activated, Sir. [tagline]"
 * e.g. "NOVA — Editor Agent is activated, Sir. Ready to start editing."
 *
 * Design notes:
 *  - A single FIFO speech queue serializes ALL spoken output (announcements
 *    and final replies), so voices never overlap mid-task.
 *  - `announceAgent` is fire-and-forget: the announcement starts immediately
 *    while the agent's actual work proceeds in parallel — dramatic AND fast.
 *  - Per-agent voices come from AgentDef.voice (ElevenLabs primary, Piper /
 *    Web Speech fallbacks inside voice.speak), so the user can recognize who
 *    is speaking.
 *  - A short de-dup window prevents the same agent announcing twice in a row
 *    (e.g. routed by the LLM *and* engaged as an implemented agent).
 */
import { voice, type SpeakOptions } from "@/lib/voice";
import { sfx } from "@/lib/sfx";
import { agentById, CEO } from "@/data/agents";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAppStore } from "@/store/useAppStore";

/* ── Serialized speech queue ──────────────────────────────────────── */

let queue: Promise<void> = Promise.resolve();

/**
 * Speaks `text` after everything already queued has finished.
 * All Cinem AI Assistant speech should flow through here to avoid overlapping audio.
 */
export function speakQueued(text: string, opts?: SpeakOptions): Promise<void> {
  const run = async () => {
    const settings = useSettingsStore.getState();
    const app = useAppStore.getState();
    // Language hint follows the user's detected language (ElevenLabs
    // multilingual auto-detects from the text; Web Speech needs the tag).
    opts = { lang: app.language.bcp47, ...opts };
    const prev = app.voiceStatus;
    if (prev === "idle") app.setVoiceStatus("speaking");
    try {
      await voice.speak(text, settings, opts);
    } catch (e) {
      console.warn("[announcer] speech failed:", e);
    } finally {
      const cur = useAppStore.getState().voiceStatus;
      if (cur === "speaking") useAppStore.getState().setVoiceStatus(prev === "speaking" ? "idle" : prev);
    }
  };
  queue = queue.then(run, run);
  return queue;
}

/* ── Agent activation announcements ───────────────────────────────── */

const ANNOUNCE_DEDUP_MS = 20_000;
const lastAnnounced = new Map<string, number>();

function shouldAnnounce(id: string): boolean {
  const s = useSettingsStore.getState();
  if (!s.agentAnnouncements) return false;
  const now = Date.now();
  const last = lastAnnounced.get(id) ?? 0;
  if (now - last < ANNOUNCE_DEDUP_MS) return false;
  lastAnnounced.set(id, now);
  return true;
}

/**
 * Announces a sub-agent activation in its own voice (fire-and-forget).
 * Format: "[CODENAME] — [Agent Name] is activated, Sir. [tagline]"
 * Returns immediately; audio plays via the serialized queue.
 */
export function announceAgent(id: string, customTagline?: string): void {
  // Live store lookup first — covers user-built custom agents too.
  const agent =
    useAppStore.getState().agents.find((a) => a.id === id) ?? agentById(id);
  if (!agent || !shouldAnnounce(id)) return;
  sfx.activate(); // rising sting under the activation
  const line = `${agent.codename} — ${agent.name} is activated, Sir. ${customTagline ?? agent.tagline}`;
  void speakQueued(line, {
    voiceId: agent.voice.elevenVoiceId,
    piperVoice: agent.voice.piperVoice,
  });
}

/**
 * Announces the CEO / Main Orchestrator ("SAM" — deep, confident voice).
 * Used when the deep-reasoning pipeline takes command of a complex task.
 */
export function announceCEO(customLine?: string): void {
  if (!shouldAnnounce(CEO.id)) return;
  const line = customLine ?? `${CEO.codename} online, Sir. Taking command. ${CEO.tagline}`;
  void speakQueued(line, { voiceId: CEO.voice.elevenVoiceId });
}
