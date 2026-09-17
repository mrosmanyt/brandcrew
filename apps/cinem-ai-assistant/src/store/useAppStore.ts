import { create } from "zustand";
import { AGENTS, type AgentDef, type AgentStatus } from "@/data/agents";
import { DEFAULT_LANG, type Lang } from "@/lib/language";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  time: string;
  /** "thought" = orchestrator brain block (thinking process) */
  kind?: "thought";
  steps?: string[];
  routedAgents?: string[];
  pending?: boolean;
}

export type VoiceStatus = "idle" | "listening" | "transcribing" | "speaking";
export type CenterView = "hub" | "world" | "player" | "radar";

export interface PlayerVideo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  embedUrl?: string;
}

interface AppState {
  /* Sub-agents */
  agents: AgentDef[];
  toggleAgent: (id: string) => void;
  setAgentStatus: (id: string, status: AgentStatus) => void;
  /** id → activation timestamp; drives the SUB AGENTS panel glow burst. */
  agentFlash: Record<string, number>;
  /** Triggers the dramatic activation glow on an agent card. */
  flashAgent: (id: string) => void;
  /** Custom Skills: add user-built agents to the grid (dedup by id). */
  addAgents: (defs: AgentDef[]) => void;
  removeAgent: (id: string) => void;

  /* Center view (Visual Intelligence Hub ⇄ World Monitor) */
  centerView: CenterView;
  setCenterView: (v: CenterView) => void;

  /* Cinem AI Assistant Player */
  currentVideo: PlayerVideo | null;
  playerResults: PlayerVideo[];
  /** Recently played media (persisted) — shown in the Media Link sidebar. */
  playHistory: PlayerVideo[];
  /** Loads a video into the Cinem AI Assistant Player and switches the center view. */
  playVideo: (v: PlayerVideo) => void;
  setPlayerResults: (r: PlayerVideo[]) => void;
  /** Remote control for embedded player (voice commands). */
  playerCommand: { action: "play" | "pause" | "next"; tick: number } | null;
  dispatchPlayerCommand: (action: "play" | "pause" | "next") => void;

  /* Chat */
  messages: ChatMessage[];
  addMessage: (m: Omit<ChatMessage, "id" | "time">) => string;
  patchMessage: (id: string, patch: Partial<ChatMessage>) => void;
  appendStep: (id: string, step: string) => void;
  clearChat: () => void;

  /* Voice */
  voiceStatus: VoiceStatus;
  setVoiceStatus: (v: VoiceStatus) => void;

  /* Multi-language intelligence */
  /** Language of the user's LAST message — Cinem AI Assistant replies in this language. */
  language: Lang;
  setLanguage: (l: Lang) => void;
}

const now = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const uid = () => crypto.randomUUID();

/* Recently-played media — persisted locally so Media Link survives restarts */
const HISTORY_KEY = "cinem-ai-assistant-media-history";
const loadHistory = (): PlayerVideo[] => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as PlayerVideo[];
  } catch {
    return [];
  }
};

const bootMessages = (): ChatMessage[] => [
  {
    id: uid(),
    role: "assistant",
    text: "Cinem AI Assistant is ready. Type a message or tap the microphone.",
    time: now(),
  },
];

export const useAppStore = create<AppState>((set) => ({
  agents: AGENTS,

  toggleAgent: (id) =>
    set((s) => ({
      agents: s.agents.map((a) =>
        a.id === id && a.status !== "processing" // can't toggle mid-task
          ? { ...a, status: a.status === "active" ? "standby" : "active" }
          : a,
      ),
    })),

  setAgentStatus: (id, status) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, status } : a)),
    })),

  agentFlash: {},
  flashAgent: (id) =>
    set((s) => ({ agentFlash: { ...s.agentFlash, [id]: Date.now() } })),

  addAgents: (defs) =>
    set((s) => ({
      agents: [...s.agents, ...defs.filter((d) => !s.agents.some((a) => a.id === d.id))],
    })),
  removeAgent: (id) =>
    set((s) => ({ agents: s.agents.filter((a) => a.id !== id) })),

  centerView: "hub",
  setCenterView: (v) => set({ centerView: v }),

  currentVideo: null,
  playerResults: [],
  playHistory: loadHistory(),
  playVideo: (v) =>
    set((s) => {
      const playHistory = [v, ...s.playHistory.filter((x) => x.id !== v.id)].slice(0, 8);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(playHistory));
      } catch {
        /* storage full/blocked — history is non-critical */
      }
      return { currentVideo: v, centerView: "player", playHistory };
    }),
  setPlayerResults: (r) => set({ playerResults: r }),
  playerCommand: null,
  dispatchPlayerCommand: (action) =>
    set({ playerCommand: { action, tick: Date.now() } }),

  messages: bootMessages(),

  addMessage: (m) => {
    const id = uid();
    set((s) => ({ messages: [...s.messages, { ...m, id, time: now() }] }));
    return id;
  },

  patchMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

  appendStep: (id, step) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, steps: [...(m.steps ?? []), step] } : m,
      ),
    })),

  clearChat: () => set({ messages: bootMessages() }),

  voiceStatus: "idle",
  setVoiceStatus: (v) => set({ voiceStatus: v }),

  language: DEFAULT_LANG,
  setLanguage: (l) => set({ language: l }),
}));
