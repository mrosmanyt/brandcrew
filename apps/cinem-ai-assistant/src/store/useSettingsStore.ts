import { create } from "zustand";
import { useAppStore } from "@/store/useAppStore";
import { notify } from "@/store/useToastStore";
import { applyTheme, themeById } from "@/lib/themes";
import { DEFAULT_CHARACTER_ID, FISH_AUDIO_DEFAULT_MODEL } from "@/lib/character-voices";
import { DEFAULT_DEEPGRAM_VOICE_ID } from "@/lib/deepgram-voices";
import type { AgentStatus } from "@/data/agents";

/* ── Settings model ───────────────────────────────────────────────── */
export interface Settings {
  /* API */
  geminiKey: string;
  /** Anthropic (Claude) API key. */
  anthropicKey: string;
  ollamaUrl: string;
  ollamaModel: string;
  /** Premium display model the user picked (mapped to a cheaper real model
   *  by src/lib/models.ts). */
  defaultModel: "claude-opus-4.8" | "gemini-2.5-pro" | "ollama";
  /** Optional Advanced override — an explicit REAL backend model id.
   *  "" = auto (use the cost-optimized mapping). */
  advancedModel: string;
  youtubeKey: string;
  /** World Monitor digest key (`wm_…`). Optional — public headlines still work. */
  worldMonitorKey: string;
  /* Voice */
  whisperModel: "tiny" | "base" | "small" | "medium" | "large-v3";
  /** Speech-to-text engine preference. Auto: Deepgram if keyed, else platform default. */
  sttEngine: "auto" | "deepgram" | "webspeech" | "whisper";
  /** Deepgram API key for paid STT/TTS (optional — Settings or DEEPGRAM_API_KEY). */
  deepgramApiKey: string;
  /** Deepgram Aura / Aura-2 model id for TTS (e.g. aura-2-thalia-en). */
  deepgramVoiceId: string;
  ttsEngine: "auto" | "deepgram" | "fish" | "elevenlabs" | "piper" | "webspeech";
  /** Named character (Aria, Zara, …). */
  characterVoice: string;
  /** Product default is English. "auto" follows the last user message. */
  preferredLanguage: string;
  fishAudioKey: string;
  fishModel: string;
  /** Optional per-character Fish Audio reference_id overrides. */
  fishVoiceIds: Record<string, string>;
  elevenKey: string;
  elevenVoiceId: string;
  piperVoicePath: string;
  /** Speak "[Name] is activated, Sir." whenever an agent engages. */
  agentAnnouncements: boolean;
  /** Synthesized UI sound effects (ticks, chirps, stings). */
  uiSounds: boolean;
  /** Risk Radar (Sentinel threat display) in the Intelligence Hub. */
  showRadar: boolean;
  /** Morning Protocol — daily spoken briefing. */
  morningEnabled: boolean;
  morningTime: string; // "HH:MM" 24h
  /** Short greeting when the assistant opens (once per session). */
  sessionBriefingEnabled: boolean;
  /* Gmail (OSCAR — Email Agent) */
  gmailClientId: string;
  gmailClientSecret: string;
  gmailRefreshToken: string;
  gmailEmail: string;
  /* Appearance */
  /** Active theme id (see src/lib/themes.ts THEMES). */
  theme: string;
  /* Remote control — Telegram (primary) */
  telegramToken: string;
  /** Linked chat id — ONLY this chat may command Cinem AI Assistant ("" = unpaired). */
  telegramChatId: string;
  telegramEnabled: boolean;
  /* Remote control — WhatsApp (via Playwright sidecar) */
  /** User's own number with country code, e.g. +92300xxxxxxx. */
  waNumber: string;
  waEnabled: boolean;
  /** WhatsApp Cloud API (Meta Business) — optional BYOK for desktop replies. */
  whatsappToken: string;
  whatsappPhoneNumberId: string;
  /** Linked phone for Cloud API inbound routing (paired via desk). */
  whatsappLinkedPhone: string;
  /** Dev toggles — mirror env feature flags in Settings → Remote. */
  remoteControlDevEnabled: boolean;
  socialPlaybooksDevEnabled: boolean;
  /* NOVA video editor */
  /** Folder NOVA pulls clips from ("last 10 videos"). */
  clipsFolder: string;
  /** CapCut executable path (optional — opened after export). */
  capcutPath: string;
  /* General */
  alwaysOnTop: boolean;
  autoStart: boolean;
  /** Auto Update — download new versions when found (restart still manual). */
  autoUpdate: boolean;
  /* Agents enabled/disabled (id → status) */
  agentStatus: Record<string, AgentStatus>;
}

export const DEFAULT_SETTINGS: Settings = {
  geminiKey: "",
  anthropicKey: "",
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "llama3.2",
  // Premium default (maps to cheap Sonnet under the hood). Falls back to
  // Gemini Flash automatically if no Anthropic key is set.
  defaultModel: "claude-opus-4.8",
  advancedModel: "",
  // Enter your own YouTube Data API key in Settings → API (Cinem AI Assistant Player).
  youtubeKey: "",
  worldMonitorKey: "",
  whisperModel: "base",
  sttEngine: "auto",
  deepgramApiKey: "",
  deepgramVoiceId: DEFAULT_DEEPGRAM_VOICE_ID,
  ttsEngine: "auto",
  characterVoice: DEFAULT_CHARACTER_ID,
  preferredLanguage: "en",
  fishAudioKey: "",
  fishModel: FISH_AUDIO_DEFAULT_MODEL,
  fishVoiceIds: {},
  // Enter your own ElevenLabs key in Settings → API (voice).
  elevenKey: "",
  elevenVoiceId: "EXAVITQu4vr4xnSDxMaL", // "Bella" — soft, sweet, warm (change in Settings)
  piperVoicePath: "voices/en_US-amy-medium.onnx",
  agentAnnouncements: true,
  uiSounds: true,
  showRadar: true,
  morningEnabled: false,
  morningTime: "08:30",
  sessionBriefingEnabled: true,
  // Enter your own Google OAuth desktop client in Settings → API (email agent).
  gmailClientId: "",
  gmailClientSecret: "",
  gmailRefreshToken: "",
  gmailEmail: "",
  theme: "cyberpunk",
  telegramToken: "",
  telegramChatId: "",
  telegramEnabled: false,
  waNumber: "",
  waEnabled: false,
  whatsappToken: "",
  whatsappPhoneNumberId: "",
  whatsappLinkedPhone: "",
  remoteControlDevEnabled: false,
  socialPlaybooksDevEnabled: false,
  clipsFolder: "",
  capcutPath: "",
  alwaysOnTop: false,
  autoStart: false,
  autoUpdate: true,
  agentStatus: {},
};

/* ── Persistence backend: Tauri store when available, localStorage in
      plain-browser dev so `npm run dev` still works. ─────────────── */
const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const STORE_FILE = "cinem-ai-assistant-settings.json";
const LS_KEY = "cinem-ai-assistant-settings";

type TauriStore = {
  get<T>(k: string): Promise<T | undefined>;
  set(k: string, v: unknown): Promise<void>;
  save(): Promise<void>;
  clear(): Promise<void>;
};

let tauriStore: TauriStore | null = null;

async function backendLoad(): Promise<Partial<Settings> | null> {
  if (IS_TAURI) {
    const storeMod = await import("@tauri-apps/plugin-store");
    // Retype `load` loosely so the options shape can't break the build across
    // plugin-store versions, and pass an explicit `defaults` (required by some
    // versions, harmless otherwise). Result is cast through our minimal type.
    const load = storeMod.load as unknown as (
      path: string,
      options?: unknown,
    ) => Promise<TauriStore>;
    tauriStore = await load(STORE_FILE, { defaults: {} });
    return ((await tauriStore.get<Partial<Settings>>("settings")) ?? null);
  }
  const raw = localStorage.getItem(LS_KEY);
  return raw ? (JSON.parse(raw) as Partial<Settings>) : null;
}

async function backendSave(settings: Settings) {
  if (IS_TAURI && tauriStore) {
    await tauriStore.set("settings", settings);
    await tauriStore.save();
  } else {
    localStorage.setItem(LS_KEY, JSON.stringify(settings));
  }
}

/* ── OS-level side effects (always-on-top, autostart) ─────────────── */
async function applyAlwaysOnTop(v: boolean) {
  if (!IS_TAURI) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setAlwaysOnTop(v);
}

async function applyAutoStart(v: boolean) {
  if (!IS_TAURI) return;
  const { enable, disable } = await import("@tauri-apps/plugin-autostart");
  if (v) await enable();
  else await disable();
}

/* ── Store ────────────────────────────────────────────────────────── */
interface SettingsState extends Settings {
  open: boolean;
  loaded: boolean;
  setOpen: (v: boolean) => void;
  /** Merge + persist a partial settings update (with OS side effects). */
  update: (p: Partial<Settings>) => Promise<void>;
  /** Load persisted settings on boot and apply them. */
  init: () => Promise<void>;
  /** Clear memory: wipe settings + chat back to defaults. */
  reset: () => Promise<void>;
}

const pickSettings = (s: SettingsState): Settings => ({
  geminiKey: s.geminiKey,
  anthropicKey: s.anthropicKey,
  ollamaUrl: s.ollamaUrl,
  ollamaModel: s.ollamaModel,
  defaultModel: s.defaultModel,
  advancedModel: s.advancedModel,
  youtubeKey: s.youtubeKey,
  worldMonitorKey: s.worldMonitorKey,
  whisperModel: s.whisperModel,
  sttEngine: s.sttEngine,
  deepgramApiKey: s.deepgramApiKey,
  deepgramVoiceId: s.deepgramVoiceId,
  ttsEngine: s.ttsEngine,
  characterVoice: s.characterVoice,
  preferredLanguage: s.preferredLanguage,
  fishAudioKey: s.fishAudioKey,
  fishModel: s.fishModel,
  fishVoiceIds: s.fishVoiceIds,
  elevenKey: s.elevenKey,
  elevenVoiceId: s.elevenVoiceId,
  piperVoicePath: s.piperVoicePath,
  agentAnnouncements: s.agentAnnouncements,
  uiSounds: s.uiSounds,
  showRadar: s.showRadar,
  morningEnabled: s.morningEnabled,
  morningTime: s.morningTime,
  sessionBriefingEnabled: s.sessionBriefingEnabled,
  gmailClientId: s.gmailClientId,
  gmailClientSecret: s.gmailClientSecret,
  gmailRefreshToken: s.gmailRefreshToken,
  gmailEmail: s.gmailEmail,
  theme: s.theme,
  telegramToken: s.telegramToken,
  telegramChatId: s.telegramChatId,
  telegramEnabled: s.telegramEnabled,
  waNumber: s.waNumber,
  waEnabled: s.waEnabled,
  whatsappToken: s.whatsappToken,
  whatsappPhoneNumberId: s.whatsappPhoneNumberId,
  whatsappLinkedPhone: s.whatsappLinkedPhone,
  remoteControlDevEnabled: s.remoteControlDevEnabled,
  socialPlaybooksDevEnabled: s.socialPlaybooksDevEnabled,
  clipsFolder: s.clipsFolder,
  capcutPath: s.capcutPath,
  alwaysOnTop: s.alwaysOnTop,
  autoStart: s.autoStart,
  autoUpdate: s.autoUpdate,
  agentStatus: s.agentStatus,
});

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  open: false,
  loaded: false,

  setOpen: (v) => set({ open: v }),

  update: async (p) => {
    set(p);
    try {
      // Theme switch — animated crossfade across the whole UI
      if (p.theme !== undefined) applyTheme(themeById(p.theme), true);
      if (p.alwaysOnTop !== undefined) await applyAlwaysOnTop(p.alwaysOnTop);
      if (p.autoStart !== undefined) await applyAutoStart(p.autoStart);
      await backendSave(pickSettings(get()));
    } catch (e) {
      notify("error", `Failed to save settings: ${e}`);
    }
  },

  init: async () => {
    try {
      const saved = await backendLoad();
      if (saved) set({ ...DEFAULT_SETTINGS, ...saved });
      const s = get();
      // Restore the saved theme instantly (no fade on boot)
      applyTheme(themeById(s.theme));
      if (s.preferredLanguage && s.preferredLanguage !== "auto") {
        const { LANGS, DEFAULT_LANG } = await import("@/lib/language");
        useAppStore.getState().setLanguage(LANGS[s.preferredLanguage] ?? DEFAULT_LANG);
      }
      // Re-apply persisted agent statuses to the live agent grid
      if (Object.keys(s.agentStatus).length) {
        for (const [id, status] of Object.entries(s.agentStatus)) {
          useAppStore.getState().setAgentStatus(id, status);
        }
      }
      if (s.alwaysOnTop) await applyAlwaysOnTop(true);
      // Auto-start remote-control bridges (dynamic import — avoids an
      // import cycle: settings → telegram/whatsapp → orchestrator → settings)
      if (s.telegramEnabled && s.telegramToken) {
        void import("@/lib/telegram").then((m) => m.startTelegram());
      }
      if (s.waEnabled && s.waNumber) {
        void import("@/lib/whatsapp").then((m) => m.startWhatsApp());
      }
      if (s.remoteControlDevEnabled) {
        const { setRemoteControlLocalEnabled } = await import("@/lib/remote-control/feature");
        setRemoteControlLocalEnabled(true);
        void import("@/lib/remote-poll").then((m) => m.startRemotePoll());
      }
      if (s.socialPlaybooksDevEnabled) {
        const { setSocialPlaybooksLocalEnabled } = await import("@/lib/social-playbooks/feature");
        setSocialPlaybooksLocalEnabled(true);
      }
      // Update check shortly after boot (auto-download if enabled).
      setTimeout(() => {
        void import("@/lib/updater").then((m) =>
          m.checkForUpdate({ auto: true, silent: true }),
        );
      }, 8000);
      set({ loaded: true });
    } catch (e) {
      notify("error", `Settings load failed: ${e}`);
      set({ loaded: true });
    }

    // Persist agent toggles whenever the grid changes (Settings or SubAgents panel)
    useAppStore.subscribe((appState) => {
      const map: Record<string, AgentStatus> = {};
      // "processing" is transient — persist it as "active"
      for (const a of appState.agents)
        map[a.id] = a.status === "processing" ? "active" : a.status;
      const prev = get().agentStatus;
      if (JSON.stringify(prev) !== JSON.stringify(map)) {
        set({ agentStatus: map });
        backendSave(pickSettings(get())).catch(() => undefined);
      }
    });
  },

  reset: async () => {
    try {
      set({ ...DEFAULT_SETTINGS });
      applyTheme(themeById(DEFAULT_SETTINGS.theme), true);
      if (IS_TAURI && tauriStore) await tauriStore.clear();
      else localStorage.removeItem(LS_KEY);
      await backendSave(pickSettings(get()));
      useAppStore.getState().clearChat();
      notify("success", "Memory cleared — Cinem AI Assistant reset to defaults.");
    } catch (e) {
      notify("error", `Reset failed: ${e}`);
    }
  },
}));
