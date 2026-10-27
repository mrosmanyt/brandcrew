/**
 * Custom Agents — user-built skills ("Create a new agent named Zain for
 * stock market analysis"). 100% local.
 *
 * A custom agent is a full AgentDef: it appears in the SUB AGENTS panel
 * (CEO wires included), gets its own ElevenLabs voice + activation
 * announcement, can be routed by the orchestrator, and executes with its
 * own LLM system prompt. Persisted in localStorage; toggles persist via the
 * existing agentStatus mechanism.
 */
import { useAppStore } from "@/store/useAppStore";
import { chatLLM } from "@/lib/llm";
import { announceAgent } from "@/lib/announcer";
import type { AgentDef } from "@/data/agents";
import type { Settings } from "@/store/useSettingsStore";

const LS_KEY = "cinem-ai-assistant-custom-agents";

/** Distinct premade ElevenLabs voices for custom agents (hash-assigned). */
const VOICE_POOL = [
  { elevenVoiceId: "TxGEqnHWrfWFTfGW9XjX", personality: "Deep, assured" },        // Josh
  { elevenVoiceId: "EXAVITQu4vr4xnSDxMaL", personality: "Clear, friendly" },      // Sarah
  { elevenVoiceId: "ErXwobaYiN019PkySvjV", personality: "Smooth, articulate" },   // Antoni
  { elevenVoiceId: "ThT5KcBeYPX3keUQqHPh", personality: "Warm, wise" },           // Dorothy
  { elevenVoiceId: "yoZ06aMxZJJ28mfd3POQ", personality: "Calm, balanced" },       // Sam
  { elevenVoiceId: "pFZP5JQG7iQjIQuC4Bku", personality: "Bright, precise" },      // Lily
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* ── Persistence ──────────────────────────────────────────────────── */

function loadDefs(): AgentDef[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as AgentDef[];
  } catch {
    return [];
  }
}

function saveDefs(defs: AgentDef[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(defs));
}

/** Call once at boot (BEFORE settings init, so persisted statuses apply). */
export function loadCustomAgents(): void {
  const defs = loadDefs();
  if (defs.length) useAppStore.getState().addAgents(defs);
}

/* ── Create / delete ──────────────────────────────────────────────── */

export async function createCustomAgent(
  name: string,
  purpose: string,
  settings: Settings,
): Promise<AgentDef> {
  const codename = name.trim().toUpperCase().slice(0, 12);
  const id = `custom-${codename.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  if (useAppStore.getState().agents.some((a) => a.id === id)) {
    throw new Error(`An agent named ${codename} already exists.`);
  }

  /* LLM writes the persona; deterministic fallback if no model is up. */
  let role = `Specialist for ${purpose}.`;
  let tagline = `Analyzing ${purpose}.`;
  let prompt =
    `You are ${codename}, Cinem AI Assistant's specialist agent for ${purpose}. ` +
    "You give concrete, expert, actionable answers in Cinem AI Assistant's confident tone.";
  try {
    const raw = await chatLLM(
      `Design an AI agent persona. Name: "${codename}". Purpose: "${purpose}".

Respond with ONLY this JSON:
{"role":"<one sentence describing what it does>","tagline":"<short working line spoken after activation, e.g. 'Scanning the markets.'>","systemPrompt":"<2-3 sentence expert system prompt in second person>"}`,
      settings,
      { json: true, temperature: 0.5, maxTokens: 400 },
    );
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      const p = JSON.parse(m[0]) as { role?: string; tagline?: string; systemPrompt?: string };
      role = p.role || role;
      tagline = p.tagline || tagline;
      prompt = p.systemPrompt || prompt;
    }
  } catch { /* fallback persona stands */ }

  const voice = VOICE_POOL[hash(id) % VOICE_POOL.length];
  const def: AgentDef = {
    id,
    name: `${name.trim()} (Custom)`,
    codename,
    role,
    status: "active",
    tagline,
    voice,
    custom: true,
    prompt,
  };

  saveDefs([...loadDefs(), def]);
  useAppStore.getState().addAgents([def]);
  useAppStore.getState().flashAgent(id);
  announceAgent(id, `Reporting for duty. ${tagline}`);
  return def;
}

export function deleteCustomAgent(id: string): boolean {
  const defs = loadDefs();
  if (!defs.some((d) => d.id === id)) return false;
  saveDefs(defs.filter((d) => d.id !== id));
  useAppStore.getState().removeAgent(id);
  return true;
}

/** Finds a custom agent by spoken name/codename ("delete agent zain"). */
export function findCustomAgent(nameish: string): AgentDef | undefined {
  const n = nameish.trim().toLowerCase();
  return useAppStore
    .getState()
    .agents.find(
      (a) => a.custom && (a.codename.toLowerCase() === n || a.name.toLowerCase().startsWith(n)),
    );
}
