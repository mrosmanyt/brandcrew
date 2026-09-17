import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, KeyRound, Mic2, Bot, SlidersHorizontal, Volume2, Trash2, Save,
  ShieldCheck, LogOut, Camera, MonitorUp, Mail, Loader2, BrainCircuit, Plus,
  Palette, Check, Smartphone, Send, MessageCircle, Copy, Unlink,
  DownloadCloud, RotateCw, RefreshCcw,
} from "lucide-react";
import { useUpdateStore, checkForUpdate, downloadAndInstall, relaunchApp, setAutoUpdateEnabled, subscribeToUpdates } from "@/lib/updater";
import { THEMES, applyTheme, themeById, type Theme as UITheme } from "@/lib/themes";
import { startTelegram, stopTelegram } from "@/lib/telegram";
import { startWhatsApp, stopWhatsAppHard } from "@/lib/whatsapp";
import { useIntegrationsStore } from "@/store/useIntegrationsStore";
import { connectGmail, disconnectGmail } from "@/lib/gmail";
import { allMemories, addMemory, deleteMemory, clearMemories, type MemoryEntry } from "@/lib/longMemory";
import { createCustomAgent, deleteCustomAgent } from "@/lib/customAgents";
import { useSettingsStore, type Settings } from "@/store/useSettingsStore";
import { DISPLAY_MODELS, ADVANCED_MODELS } from "@/lib/models";
import { PLATFORMS, connectPlatform, type Platform } from "@/lib/uploader";
import { connectGrok } from "@/lib/grokGen";
import { useAppStore } from "@/store/useAppStore";
import { useUserStore } from "@/store/useUserStore";
import { useVisionStore } from "@/store/useVisionStore";
import { notify } from "@/store/useToastStore";
import { voice } from "@/lib/voice";
import {
  CHARACTER_VOICES,
  FISH_AUDIO_DEFAULT_MODEL,
  welcomeLine,
} from "@/lib/character-voices";
import {
  DEEPGRAM_LANGUAGE_FILTERS,
  filterDeepgramVoices,
  getDeepgramVoice,
  resolveDeepgramVoiceId,
  type DeepgramVoiceEntry,
} from "@/lib/deepgram-voices";
import { deepgramConfigured, listDeepgramVoices } from "@/lib/deepgramVoice";
import { cn } from "@/lib/utils";

type Tab = "api" | "appearance" | "voice" | "agents" | "memory" | "remote" | "account" | "general";

const TABS: { id: Tab; label: string; icon: typeof KeyRound }[] = [
  { id: "api", label: "API", icon: KeyRound },
  { id: "appearance", label: "Themes", icon: Palette },
  { id: "voice", label: "Voice", icon: Mic2 },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "memory", label: "Memory", icon: BrainCircuit },
  { id: "remote", label: "Remote", icon: Smartphone },
  { id: "account", label: "Account", icon: ShieldCheck },
  { id: "general", label: "General", icon: SlidersHorizontal },
];

/* ── Small form primitives (shadcn-style, themed for Cinem AI Assistant) ──────── */

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="panel-title mb-1.5 block !text-[0.62rem] text-neon-dim">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[0.68rem] text-neon-dim/70">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full border border-neon/20 bg-abyss/80 px-3 py-2 text-sm text-ice placeholder:text-neon-dim/50 outline-none transition-colors focus:border-neon/50";

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}

function Select({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, "appearance-none")}>
      {options.map(([v, label]) => (
        <option key={v} value={v} className="bg-abyss text-ice">{label}</option>
      ))}
    </select>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-10 shrink-0 rounded-full border transition-colors",
        checked ? "border-neon/70 bg-neon/30" : "border-neon/20 bg-abyss",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-3.5 rounded-full transition-all",
          checked ? "left-[22px] bg-neon shadow-[0_0_8px_rgba(var(--glow),0.8)]" : "left-0.5 bg-slate-500",
        )}
      />
    </button>
  );
}

/* ── Tab contents ─────────────────────────────────────────────────── */

function ApiTab() {
  const s = useSettingsStore();
  const [claude, setClaude] = useState(s.anthropicKey);
  const [gemini, setGemini] = useState(s.geminiKey);
  const [ollama, setOllama] = useState(s.ollamaUrl);
  const [ollamaModel, setOllamaModel] = useState(s.ollamaModel);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Premium display options (labels are the flagship names).
  const modelOptions: [string, string][] = DISPLAY_MODELS.map((m) => [
    m.id,
    m.sublabel ? `${m.label} — ${m.sublabel}` : m.label,
  ]);

  const save = async () => {
    await s.update({
      anthropicKey: claude.trim(),
      geminiKey: gemini.trim(),
      ollamaUrl: ollama.trim(),
      ollamaModel: ollamaModel.trim() || "llama3.2",
      worldMonitorKey: s.worldMonitorKey.trim(),
    });
    notify("success", "API configuration saved.");
  };

  return (
    <div className="space-y-4">
      {/* Premium model picker (maps to cost-optimized backend under the hood) */}
      <Field label="AI Model" hint="Choose your assistant's brain. Cinem AI Assistant auto-optimizes for speed & reliability.">
        <Select
          value={s.defaultModel}
          onChange={(v) => s.update({ defaultModel: v as Settings["defaultModel"] })}
          options={modelOptions}
        />
      </Field>

      {/* ── Claude ── */}
      <Field label="Claude API Key" hint="Anthropic key (sk-ant-…). Powers the Claude models.">
        <TextInput type="password" value={claude} onChange={(e) => setClaude(e.target.value)} placeholder="sk-ant-…" />
      </Field>

      {/* ── Gemini ── */}
      <Field label="Gemini API Key" hint="Google AI key (AIza…). Stored locally — never leaves this machine.">
        <TextInput type="password" value={gemini} onChange={(e) => setGemini(e.target.value)} placeholder="AIza…" />
      </Field>

      <Field label="YouTube API Key" hint="Powers Cinem AI Assistant Player search ('play … on youtube').">
        <TextInput
          type="password"
          value={s.youtubeKey}
          onChange={(e) => void s.update({ youtubeKey: e.target.value.trim() })}
          placeholder="AIza…"
        />
      </Field>

      <Field
        label="World Monitor API Key"
        hint="Optional wm_… key from worldmonitor.app (Settings / API on their site). Official digest for Today Headlines + World Monitor — Live. Without it, CINEM Pro still shows a public news feed."
      >
        <TextInput
          type="password"
          value={s.worldMonitorKey}
          onChange={(e) => void s.update({ worldMonitorKey: e.target.value.trim() })}
          placeholder="wm_…"
        />
      </Field>

      <Field
        label="Fish Audio API Key"
        hint="Optional TTS. Paste a key from fish.audio → API Keys. Stored only on this machine. See docs/fish-audio-voices.md. Leave empty to use Windows Neural voices."
      >
        <TextInput
          type="password"
          value={s.fishAudioKey}
          onChange={(e) => void s.update({ fishAudioKey: e.target.value })}
          placeholder="Fish Audio API key"
          autoComplete="off"
        />
      </Field>

      <button onClick={save} className="glass flex items-center gap-2 px-4 py-2 text-sm text-neon hover:bg-neon/10">
        <Save className="size-4" /> Save API Settings
      </button>

      {/* ── Advanced (optional real-model override + Ollama) ── */}
      <button
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-2 text-xs tracking-wide text-neon-dim transition-colors hover:text-neon"
      >
        <SlidersHorizontal className="size-3.5" />
        {showAdvanced ? "Hide" : "Show"} advanced model settings
      </button>

      {showAdvanced && (
        <div className="space-y-4 border-l border-neon/15 pl-3">
          <Field label="Force Real Model (override)" hint="Pin an exact backend model. Leave on Auto for cost-optimized routing.">
            <Select
              value={s.advancedModel}
              onChange={(v) => s.update({ advancedModel: v })}
              options={ADVANCED_MODELS.map((a) => [a.value, a.label])}
            />
          </Field>
          <Field label="Ollama Base URL" hint="Local fallback when no cloud key works.">
            <TextInput value={ollama} onChange={(e) => setOllama(e.target.value)} placeholder="http://localhost:11434" />
          </Field>
          <Field label="Ollama Model" hint="Must be pulled locally, e.g. `ollama pull llama3.2`.">
            <TextInput value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} placeholder="llama3.2" />
          </Field>
        </div>
      )}

      {/* ── NOVA video editor ── */}
      <div className="border-t border-neon/10 pt-4">
        <p className="mb-2 panel-title !text-[0.6rem] text-neon">NOVA Video Editor</p>
        <div className="space-y-3">
          <Field label="Clips Folder" hint="Yahan se NOVA clips uthata hai ('last 10 videos edit kar do').">
            <TextInput
              value={s.clipsFolder}
              onChange={(e) => void s.update({ clipsFolder: e.target.value })}
              placeholder="D:\\Videos\\Raw"
            />
          </Field>
          <Field label="CapCut Path (optional)" hint="Export ke baad CapCut auto-open ho jata hai.">
            <TextInput
              value={s.capcutPath}
              onChange={(e) => void s.update({ capcutPath: e.target.value })}
              placeholder="C:\\Users\\you\\AppData\\Local\\CapCut\\…\\CapCut.exe"
            />
          </Field>
          <p className="text-[0.68rem] text-neon-dim/70">
            NOVA engine alag se chalana hota hai: <code className="text-neon">cd media-server &amp;&amp; node index.js</code>
            {" "}(ffmpeg PATH par hona chahiye).
          </p>
        </div>
      </div>

      {/* ── Social platforms (connect once, then "Upload to all") ── */}
      <div className="border-t border-neon/10 pt-4">
        <p className="mb-1 panel-title !text-[0.6rem] text-neon">Social Uploads</p>
        <p className="mb-2.5 text-[0.68rem] text-neon-dim/70">
          Connect dabane par aapka <span className="text-neon">asli Chrome</span> (bundled nahi) ek baar khulega —
          us window mein login karein. Session save ho jata hai, phir "sab channels pe upload kar do" kaafi hai.
          (Google "browser not secure" warning isi se fix hota hai.) Playwright sidecar chalu hona chahiye.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => void connectPlatform(p.id as Platform)}
              className="glass flex items-center justify-center gap-2 px-3 py-2 text-xs text-ice/85 hover:text-neon"
            >
              Connect {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => void connectGrok()}
          className="mt-2 flex w-full items-center justify-center gap-2 border border-neon/40 bg-neon/10 px-3 py-2 text-xs font-bold text-neon hover:bg-neon/20"
        >
          Connect Super Grok (video generation)
        </button>
        <p className="mt-1 text-[0.62rem] text-neon-dim/70">
          Grok aapke asli Chrome mein khulega — ek baar login karein, phir "scenes generate karo" command kaafi hai.
        </p>
      </div>

      <GmailConnect />
    </div>
  );
}

/** Gmail (OSCAR — Email Agent): OAuth connect/disconnect. */
function GmailConnect() {
  const gmailEmail = useSettingsStore((st) => st.gmailEmail);
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);
    try {
      const email = await connectGmail();
      notify("success", `Gmail connected: ${email} — OSCAR is online.`);
    } catch (e) {
      notify("error", `Gmail connect failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-neon/10 bg-abyss/50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-ice/90">
            <Mail className="size-4 text-neon" /> Gmail — OSCAR · Email Agent
          </p>
          <p className="mt-0.5 text-xs text-neon-dim">
            {gmailEmail
              ? `Connected as ${gmailEmail}. Try: "check my email" · "email ali@… about the invoice" (drafts only — never auto-sends).`
              : "Connect your Gmail so OSCAR can brief your inbox and prepare drafts. Opens Google sign-in in your browser."}
          </p>
        </div>
        {gmailEmail ? (
          <button
            onClick={() => void disconnectGmail().then(() => notify("info", "Gmail disconnected."))}
            className="shrink-0 border border-rose-400/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => void connect()}
            disabled={busy}
            className="flex shrink-0 items-center gap-2 border border-neon/50 bg-neon/15 px-3 py-1.5 text-xs font-semibold text-neon hover:bg-neon/25 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
            {busy ? "Waiting for Google…" : "Connect Gmail"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Appearance tab — Theme Engine (10 premium UI personalities) ──── */

/** Mini live mock of the app rendered ENTIRELY with the card's own theme
 *  colors (inline styles) so all 10 previews stay true while hovering. */
function ThemeMiniPreview({ t }: { t: UITheme }) {
  const radius = t.ui.shape === "rounded" ? 8 : 0;
  const cut = t.ui.shape === "hud"
    ? { clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)" }
    : {};
  const glow = t.ui.glow;

  return (
    <div
      className="relative h-24 w-full overflow-hidden"
      style={{
        background: t.colors.void,
        borderRadius: t.ui.shape === "rounded" ? 10 : 4,
        backgroundImage:
          t.ui.backdrop === "grid" || t.ui.backdrop === "horizon"
            ? `linear-gradient(${t.colors.neon}14 1px, transparent 1px), linear-gradient(90deg, ${t.colors.neon}14 1px, transparent 1px)`
            : t.ui.backdrop === "scanlines"
              ? `repeating-linear-gradient(0deg, ${t.colors.neon}11 0 1px, transparent 1px 3px)`
              : `radial-gradient(ellipse 80% 60% at 50% 20%, ${t.colors.neon}14, transparent 70%)`,
        backgroundSize:
          t.ui.backdrop === "grid" || t.ui.backdrop === "horizon" ? "14px 14px" : undefined,
      }}
    >
      {/* orb */}
      <span
        className="absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle at 38% 35%, ${t.colors.ice}, ${t.colors.neon} 60%, transparent)`,
          boxShadow: `0 0 ${18 * glow + 4}px ${t.colors.neon}`,
        }}
      />
      {/* side panels */}
      {[{ left: 6 }, { right: 6 }].map((pos, i) => (
        <span
          key={i}
          className="absolute top-2.5 h-[74px] w-10"
          style={{
            ...pos, ...cut,
            borderRadius: radius,
            background: `${t.colors.panel}cc`,
            border: `1px solid ${t.colors.neon}45`,
            boxShadow: `inset 0 0 10px ${t.colors.neon}${glow >= 0.7 ? "22" : "11"}`,
          }}
        />
      ))}
      {/* voice bar */}
      <span
        className="absolute bottom-2 left-[72px] right-[72px] h-2.5"
        style={{ ...cut, borderRadius: radius, background: `${t.colors.panel}cc`, border: `1px solid ${t.colors.neon}45` }}
      />
    </div>
  );
}

function AppearanceTab() {
  const activeId = useSettingsStore((st) => st.theme);
  const update = useSettingsStore((st) => st.update);

  /** Revert any un-committed hover preview back to the saved theme. */
  const revert = () => applyTheme(themeById(useSettingsStore.getState().theme), true);

  // Safety: if the modal/tab closes mid-hover, snap back to the saved theme.
  useEffect(() => revert, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border border-neon/30 bg-neon/[0.05] px-3 py-2.5 text-neon">
        <Palette className="size-5" />
        <div>
          <span className="font-display text-[0.7rem] font-bold tracking-[0.2em]">
            THEME ENGINE — 10 UI PERSONALITIES
          </span>
          <p className="text-[0.65rem] font-normal tracking-normal text-neon-dim">
            Hover any card for a full live preview · click to engage it permanently.
            Each theme re-skins everything — orb, wires, radar, panels, waveform.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3" onMouseLeave={revert}>
        {THEMES.map((t) => {
          const active = t.id === activeId;
          return (
            <button
              key={t.id}
              onMouseEnter={() => applyTheme(t, true)}
              onFocus={() => applyTheme(t, true)}
              onClick={() => {
                void update({ theme: t.id });
                notify("success", `Theme engaged: ${t.name}`);
              }}
              className="group relative overflow-hidden p-2 text-left transition-transform duration-200 hover:scale-[1.02]"
              style={{
                background: `linear-gradient(160deg, ${t.colors.abyss}, ${t.colors.void})`,
                border: `1px solid ${active ? t.colors.neon : `${t.colors.neon}38`}`,
                borderRadius: t.ui.shape === "rounded" ? 12 : 4,
                boxShadow: active ? `0 0 22px ${t.colors.neon}40` : undefined,
              }}
            >
              <ThemeMiniPreview t={t} />

              <div className="mt-2 flex items-start justify-between gap-2 px-0.5 pb-0.5">
                <div className="min-w-0">
                  <p
                    className="font-display text-[0.66rem] font-bold tracking-[0.14em]"
                    style={{ color: t.colors.ice }}
                  >
                    {t.name.toUpperCase()}
                  </p>
                  <p className="mt-0.5 truncate text-[0.62rem]" style={{ color: t.colors.neonDim }}>
                    {t.mood}
                  </p>
                </div>
                {/* palette swatches */}
                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                  {[t.colors.neon, t.colors.ice, t.colors.panel].map((c) => (
                    <span
                      key={c}
                      className="size-2.5 rounded-full"
                      style={{ background: c, border: `1px solid ${t.colors.neon}50` }}
                    />
                  ))}
                </div>
              </div>

              {/* active badge */}
              {active && (
                <span
                  className="absolute right-2 top-2 flex items-center gap-1 px-1.5 py-0.5 font-display text-[0.5rem] font-bold tracking-[0.18em]"
                  style={{
                    background: `${t.colors.neon}26`,
                    border: `1px solid ${t.colors.neon}90`,
                    color: t.colors.neon,
                    borderRadius: t.ui.shape === "rounded" ? 99 : 2,
                  }}
                >
                  <Check className="size-2.5" /> ACTIVE
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DeepgramVoicePicker({
  selectedId,
  apiKey,
  onSelect,
}: {
  selectedId: string;
  apiKey: string;
  onSelect: (modelId: string) => void;
}) {
  const [voices, setVoices] = useState<DeepgramVoiceEntry[]>([]);
  const [langFilter, setLangFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listDeepgramVoices(apiKey.trim() || undefined).then((list) => {
      if (!cancelled) {
        setVoices(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  const filtered = filterDeepgramVoices(voices, langFilter, query);
  const activeId = resolveDeepgramVoiceId(selectedId);
  const active = getDeepgramVoice(activeId);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <select
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value)}
          className={cn(inputCls, "w-auto min-w-[140px]")}
        >
          {DEEPGRAM_LANGUAGE_FILTERS.map(({ code, label }) => (
            <option key={code} value={code} className="bg-abyss text-ice">
              {label}
            </option>
          ))}
        </select>
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or model id…"
          className="min-w-0 flex-1"
        />
      </div>
      {active && (
        <p className="text-[0.68rem] text-neon-dim">
          Selected: <span className="text-ice/90">{active.displayName}</span> · {active.gender} ·{" "}
          {active.style} · {active.locale} · <code className="text-neon">{active.modelId}</code>
        </p>
      )}
      <div className="max-h-52 overflow-y-auto border border-neon/15 bg-abyss/40">
        {loading && (
          <p className="flex items-center gap-2 px-3 py-4 text-xs text-neon-dim">
            <Loader2 className="size-3.5 animate-spin" /> Loading Deepgram voices…
          </p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="px-3 py-4 text-xs text-neon-dim">No voices match this filter.</p>
        )}
        {!loading &&
          filtered.map((v) => (
            <button
              key={v.modelId}
              type="button"
              onClick={() => onSelect(v.modelId)}
              className={cn(
                "flex w-full flex-col gap-0.5 border-b border-neon/10 px-3 py-2 text-left transition-colors last:border-b-0",
                activeId === v.modelId
                  ? "bg-neon/10 text-ice"
                  : "text-ice/85 hover:bg-neon/5",
              )}
            >
              <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                {v.displayName}
                <span className="font-display text-[0.5rem] tracking-[0.15em] text-neon-dim">
                  {v.architecture === "aura-2" ? "AURA-2" : "AURA"}
                </span>
              </span>
              <span className="text-[0.65rem] text-neon-dim">
                {v.gender} · {v.style}
              </span>
              <span className="font-mono text-[0.62rem] text-neon/80">
                {v.locale} · {v.modelId}
              </span>
            </button>
          ))}
      </div>
      {!deepgramConfigured(apiKey) && (
        <p className="text-[0.65rem] text-neon-dim/80">
          Paste a Deepgram key below to refresh the live voice list from the API. The catalog above
          works offline.
        </p>
      )}
    </div>
  );
}

function VoiceTab() {
  const s = useSettingsStore();
  const [elevenKey, setElevenKey] = useState(s.elevenKey);
  const [deepgramKey, setDeepgramKey] = useState(s.deepgramApiKey);
  const [voiceId, setVoiceId] = useState(s.elevenVoiceId);
  const [fishKey, setFishKey] = useState(s.fishAudioKey);
  const [fishVoice, setFishVoice] = useState(s.fishVoiceIds[s.characterVoice] || "");
  const [testing, setTesting] = useState(false);
  const character = CHARACTER_VOICES.find((c) => c.id === s.characterVoice) ?? CHARACTER_VOICES[0];

  const save = async () => {
    const fishVoiceIds = { ...s.fishVoiceIds };
    if (fishVoice.trim()) fishVoiceIds[s.characterVoice] = fishVoice.trim();
    else delete fishVoiceIds[s.characterVoice];
    await s.update({
      elevenKey: elevenKey.trim(),
      deepgramApiKey: deepgramKey.trim(),
      elevenVoiceId: voiceId.trim(),
      fishAudioKey: fishKey.trim(),
      fishVoiceIds,
    });
    notify("success", "Voice configuration saved.");
  };

  const testVoice = async () => {
    setTesting(true);
    try {
      const next = {
        ...s,
        deepgramApiKey: deepgramKey.trim(),
        elevenKey: elevenKey.trim(),
        elevenVoiceId: voiceId.trim(),
        fishAudioKey: fishKey.trim(),
        fishVoiceIds: {
          ...s.fishVoiceIds,
          ...(fishVoice.trim() ? { [s.characterVoice]: fishVoice.trim() } : {}),
        },
      };
      await voice.speak(welcomeLine(s.preferredLanguage === "auto" ? "en" : s.preferredLanguage), next, {
        characterId: s.characterVoice,
        lang: character.bcp47,
      });
      notify("success", "Voice test completed.");
    } catch (e) {
      notify("error", `Voice test failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border border-neon/15 bg-neon/[0.04] px-3 py-2.5">
        <p className="text-sm font-semibold text-ice/90">Microphone</p>
        <p className="mt-1 text-xs leading-relaxed text-neon-dim">
          Tap the mic in Chat (or the bar below) to talk. STT: Deepgram Nova-2 (optional key) →
          browser recognition (Electron) → Faster-Whisper (Tauri). TTS: Deepgram Aura / Aura-2 →
          Fish Audio → ElevenLabs → Neural Windows. Keys via Settings or DEEPGRAM_API_KEY /
          VITE_DEEPGRAM_API_KEY / FISH_AUDIO_API_KEY env vars.
        </p>
      </div>
      <Field label="Character voice" hint="10 named speakers. Replies follow the language you write or speak; default language is English.">
        <div className="grid grid-cols-2 gap-1.5">
          {CHARACTER_VOICES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                void s.update({ characterVoice: c.id });
                setFishVoice(s.fishVoiceIds[c.id] || "");
              }}
              className={cn(
                "border px-2.5 py-2 text-left transition-colors",
                s.characterVoice === c.id
                  ? "border-neon/50 bg-neon/10 text-ice"
                  : "border-neon/15 bg-abyss/40 text-ice/80 hover:border-neon/30",
              )}
            >
              <span className="block text-sm font-semibold">{c.name}</span>
              <span className="block text-[0.65rem] text-neon-dim">
                {c.languageName} · {c.gender}
              </span>
            </button>
          ))}
        </div>
      </Field>
      <Field label="Spoken language" hint="Product default is English. Auto mirrors the last message.">
        <Select
          value={s.preferredLanguage}
          onChange={(v) => s.update({ preferredLanguage: v })}
          options={[
            ["en", "English (default)"],
            ["auto", "Auto — follow what I say"],
            ["ur", "Urdu"],
            ["hi", "Hindi"],
            ["tr", "Turkish"],
            ["es", "Spanish"],
            ["ar", "Arabic"],
            ["fr", "French"],
          ]}
        />
      </Field>
      <Field
        label="STT Engine"
        hint="Auto prefers Deepgram when a key is set, else platform default (browser STT or Whisper on Tauri)."
      >
        <Select
          value={s.sttEngine}
          onChange={(v) => s.update({ sttEngine: v as Settings["sttEngine"] })}
          options={[
            ["auto", "Auto (Deepgram → platform default)"],
            ["deepgram", "Deepgram Nova-2 (paid)"],
            ["webspeech", "Browser / Chromium recognition"],
            ["whisper", "Faster-Whisper (Tauri only)"],
          ]}
        />
      </Field>
      <Field
        label="Deepgram API Key"
        hint="Paid STT + Aura TTS — paste from console.deepgram.com. Also accepted as DEEPGRAM_API_KEY or VITE_DEEPGRAM_API_KEY."
      >
        <TextInput type="password" value={deepgramKey} onChange={(e) => setDeepgramKey(e.target.value)} autoComplete="off" />
      </Field>
      <Field
        label="Deepgram TTS voice"
        hint="Aura and Aura-2 speakers for assistant speech. STT language hint follows this voice when Deepgram transcribes."
      >
        <DeepgramVoicePicker
          selectedId={s.deepgramVoiceId}
          apiKey={deepgramKey}
          onSelect={(modelId) => void s.update({ deepgramVoiceId: modelId })}
        />
      </Field>
      <Field label="STT — Faster-Whisper Model" hint="Speech-to-text only (Tauri). Larger models = better accuracy, slower. Not used to speak.">
        <Select
          value={s.whisperModel}
          onChange={(v) => s.update({ whisperModel: v as Settings["whisperModel"] })}
          options={[
            ["tiny", "tiny (fastest)"], ["base", "base (recommended)"],
            ["small", "small"], ["medium", "medium"], ["large-v3", "large-v3 (best)"],
          ]}
        />
      </Field>
      <Field
        label="TTS Engine"
        hint="Auto prefers Deepgram when keyed + a voice is selected, then Fish Audio, then Neural Windows."
      >
        <Select
          value={s.ttsEngine}
          onChange={(v) => s.update({ ttsEngine: v as Settings["ttsEngine"] })}
          options={[
            ["auto", "Auto (Deepgram → Fish → Neural)"],
            ["deepgram", "Deepgram Aura / Aura-2"],
            ["fish", "Fish Audio"],
            ["webspeech", "Windows / browser Neural"],
            ["elevenlabs", "ElevenLabs"],
            ["piper", "Piper (Tauri offline)"],
          ]}
        />
      </Field>
      <Field
        label="Fish Audio API Key"
        hint="Optional. Paste from fish.audio → Developers → API Keys. Also accepted as FISH_AUDIO_API_KEY. No key is shipped in the app."
      >
        <TextInput type="password" value={fishKey} onChange={(e) => setFishKey(e.target.value)} autoComplete="off" />
      </Field>
      <Field
        label={`Fish Audio voice ID — ${character?.name ?? "character"}`}
        hint="Copy a model id from fish.audio (the voice URL). Leave empty to use Fish’s default voice until you map one."
      >
        <TextInput
          value={fishVoice}
          onChange={(e) => setFishVoice(e.target.value)}
          placeholder="reference_id from fish.audio"
        />
      </Field>
      <Field label="Fish Audio model header" hint="Documented free developer tier is s2.1-pro-free.">
        <TextInput
          value={s.fishModel || FISH_AUDIO_DEFAULT_MODEL}
          onChange={(e) => void s.update({ fishModel: e.target.value })}
        />
      </Field>
      <Field label="ElevenLabs API Key" hint="Optional fallback. Stored locally.">
        <TextInput type="password" value={elevenKey} onChange={(e) => setElevenKey(e.target.value)} />
      </Field>
      <Field label="ElevenLabs Voice ID">
        <TextInput value={voiceId} onChange={(e) => setVoiceId(e.target.value)} placeholder="21m00Tcm4TlvDq8ikWAM" />
      </Field>
      <Field label="Piper Voice Model Path" hint="Tauri offline fallback only, e.g. voices/en_US-amy-medium.onnx">
        <TextInput value={s.piperVoicePath} onChange={(e) => s.update({ piperVoicePath: e.target.value })} />
      </Field>
      <div className="flex items-center justify-between border border-neon/10 bg-abyss/50 px-3 py-3">
        <div>
          <p className="text-sm font-semibold text-ice/90">Agent Activation Announcements</p>
          <p className="text-xs text-neon-dim">
            Each agent speaks in its own voice: “NOVA — Editor Agent is activated, Sir.”
          </p>
        </div>
        <Switch checked={s.agentAnnouncements} onChange={(v) => s.update({ agentAnnouncements: v })} />
      </div>
      <div className="flex items-center justify-between border border-neon/10 bg-abyss/50 px-3 py-3">
        <div>
          <p className="text-sm font-semibold text-ice/90">UI Sound Effects</p>
          <p className="text-xs text-neon-dim">Subtle ticks, chirps and stings under key interactions.</p>
        </div>
        <Switch checked={s.uiSounds} onChange={(v) => s.update({ uiSounds: v })} />
      </div>
      <div className="flex items-center justify-between border border-neon/10 bg-abyss/50 px-3 py-3">
        <div>
          <p className="text-sm font-semibold text-ice/90">Morning Protocol</p>
          <p className="text-xs text-neon-dim">
            Daily spoken briefing — headlines, system health, your day. Also on demand: “morning briefing”.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={s.morningTime}
            onChange={(e) => void s.update({ morningTime: e.target.value })}
            className="border border-neon/20 bg-abyss/80 px-2 py-1 text-xs text-ice outline-none focus:border-neon/50"
          />
          <Switch checked={s.morningEnabled} onChange={(v) => s.update({ morningEnabled: v })} />
        </div>
      </div>
      <div className="flex items-center justify-between border border-neon/10 bg-abyss/50 px-3 py-3">
        <div>
          <p className="text-sm font-semibold text-ice/90">Session briefing</p>
          <p className="text-xs text-neon-dim">
            Short proactive greeting when you open the assistant (once per session).
          </p>
        </div>
        <Switch checked={s.sessionBriefingEnabled} onChange={(v) => s.update({ sessionBriefingEnabled: v })} />
      </div>
      <div className="flex gap-2">
        <button onClick={save} className="glass flex items-center gap-2 px-4 py-2 text-sm text-neon hover:bg-neon/10">
          <Save className="size-4" /> Save Voice Settings
        </button>
        <button
          onClick={testVoice}
          disabled={testing}
          className="glass flex items-center gap-2 px-4 py-2 text-sm text-ice hover:bg-neon/10 disabled:opacity-50"
        >
          <Volume2 className={cn("size-4", testing && "animate-pulse text-neon")} />
          {testing ? "Speaking…" : "Test Voice"}
        </button>
      </div>
    </div>
  );
}

/* ── Remote tab — control Cinem AI Assistant from your phone ──────────────────── */

/** Colored status pill shared by both integration cards. */
function StatusPill({ state, label }: { state: string; label: string }) {
  const tone =
    state === "online"
      ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
      : state === "error"
        ? "border-rose-400/50 bg-rose-500/10 text-rose-300"
        : state === "off"
          ? "border-neon/20 bg-abyss text-neon-dim"
          : "border-amber-300/50 bg-amber-400/10 text-amber-200"; // connecting/pairing/qr
  return (
    <span className={cn("shrink-0 border px-2 py-0.5 font-display text-[0.52rem] font-bold tracking-[0.18em]", tone)}>
      {label.toUpperCase()}
    </span>
  );
}

function TelegramCard() {
  const s = useSettingsStore();
  const tg = useIntegrationsStore();
  const [token, setToken] = useState(s.telegramToken);
  const busy = tg.tgState === "connecting";

  const connect = async () => {
    await s.update({ telegramToken: token.trim(), telegramEnabled: true });
    await startTelegram();
  };
  const disconnect = async () => {
    stopTelegram();
    await s.update({ telegramEnabled: false });
  };
  const unpair = async () => {
    await s.update({ telegramChatId: "" });
    await startTelegram(); // re-enters pairing mode with a fresh code
  };

  return (
    <div className="border border-neon/15 bg-abyss/50 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-ice/90">
          <Send className="size-4 text-neon" /> Telegram — Recommended
        </p>
        <StatusPill state={tg.tgState} label={tg.tgState === "off" ? "offline" : tg.tgState} />
      </div>
      <p className="mt-1 text-xs text-neon-dim">{tg.tgDetail}</p>

      {/* token + connect */}
      <div className="mt-3 flex gap-2">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Bot token from @BotFather — 123456:ABC-DEF…"
          className={cn(inputCls, "min-w-0 flex-1")}
        />
        {tg.tgState === "online" || tg.tgState === "pairing" ? (
          <button
            onClick={() => void disconnect()}
            className="shrink-0 border border-rose-400/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => void connect()}
            disabled={busy || !token.trim()}
            className="flex shrink-0 items-center gap-1.5 border border-neon/50 bg-neon/15 px-3 py-1.5 text-xs font-semibold text-neon hover:bg-neon/25 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Connect
          </button>
        )}
      </div>

      {/* pairing code — the security handshake */}
      {tg.tgState === "pairing" && (
        <div className="mt-3 border border-amber-300/40 bg-amber-400/[0.06] p-3 text-center">
          <p className="font-display text-[0.55rem] tracking-[0.25em] text-amber-200">
            PAIRING CODE — send this to @{tg.tgBotName} from your phone
          </p>
          <p className="mt-1.5 select-all font-mono text-3xl font-bold tracking-[0.35em] text-amber-100">
            {tg.tgPairCode}
          </p>
          <p className="mt-1 text-[0.65rem] text-neon-dim">
            Only the chat that sends this code will EVER be able to command Cinem AI Assistant.
          </p>
        </div>
      )}

      {/* linked info */}
      {tg.tgState === "online" && (
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-neon-dim">
            {tg.tgCommands} remote command{tg.tgCommands === 1 ? "" : "s"} this session ·
            try: <span className="text-ice/80">“open google” · “morning briefing”</span>
          </span>
          <button
            onClick={() => void unpair()}
            className="flex items-center gap-1 text-neon-dim hover:text-rose-300"
            title="Unlink the paired phone (shows a new pairing code)"
          >
            <Unlink className="size-3" /> Unpair
          </button>
        </div>
      )}

      <p className="mt-3 text-[0.65rem] leading-relaxed text-neon-dim/80">
        Setup: Telegram → search <span className="text-ice/80">@BotFather</span> → /newbot → copy the
        token here → Connect → send the pairing code to your bot. Done — Cinem AI Assistant in your pocket.
      </p>
    </div>
  );
}

function WhatsAppCard() {
  const s = useSettingsStore();
  const wa = useIntegrationsStore();
  const [number, setNumber] = useState(s.waNumber);
  const busy = wa.waState === "starting" || wa.waState === "qr";

  const start = async () => {
    await s.update({ waNumber: number.trim(), waEnabled: true });
    await startWhatsApp();
  };
  const stop = async () => {
    await stopWhatsAppHard();
    await s.update({ waEnabled: false });
  };

  return (
    <div className="border border-neon/15 bg-abyss/50 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-ice/90">
          <MessageCircle className="size-4 text-neon" /> WhatsApp — via Playwright
        </p>
        <StatusPill state={wa.waState} label={wa.waState === "off" ? "offline" : wa.waState} />
      </div>
      <p className="mt-1 text-xs text-neon-dim">{wa.waDetail}</p>

      <div className="mt-3 flex gap-2">
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Your own number with country code — +92300xxxxxxx"
          className={cn(inputCls, "min-w-0 flex-1")}
        />
        {wa.waState === "online" || busy ? (
          <button
            onClick={() => void stop()}
            className="shrink-0 border border-rose-400/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={() => void start()}
            disabled={!number.trim()}
            className="flex shrink-0 items-center gap-1.5 border border-neon/50 bg-neon/15 px-3 py-1.5 text-xs font-semibold text-neon hover:bg-neon/25 disabled:opacity-50"
          >
            <MessageCircle className="size-3.5" /> Start
          </button>
        )}
      </div>

      {wa.waState === "online" && (
        <p className="mt-2 text-xs text-neon-dim">
          {wa.waCommands} remote command{wa.waCommands === 1 ? "" : "s"} this session — message
          <span className="text-ice/80"> yourself</span> on WhatsApp to command Cinem AI Assistant.
        </p>
      )}

      <p className="mt-3 text-[0.65rem] leading-relaxed text-neon-dim/80">
        Setup: run <span className="font-mono text-ice/80">npm start</span> in /playwright-server →
        Start → scan the QR once in the Chromium window → open your own chat (“Message yourself”)
        on the phone and text commands. Cinem AI Assistant replies with 🤖 in the same chat. Security: only
        your own chat is read — nobody else can command Cinem AI Assistant.
      </p>
    </div>
  );
}

function RemoteTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border border-neon/30 bg-neon/[0.05] px-3 py-2.5 text-neon">
        <Smartphone className="size-5" />
        <div>
          <span className="font-display text-[0.7rem] font-bold tracking-[0.2em]">
            REMOTE CONTROL — Cinem AI Assistant IN YOUR POCKET
          </span>
          <p className="text-[0.65rem] font-normal tracking-normal text-neon-dim">
            Command Cinem AI Assistant from your phone. Works while this PC is on and Cinem AI Assistant is running.
            Commands run the full agent pipeline and reply back in the same chat.
          </p>
        </div>
      </div>
      <TelegramCard />
      <WhatsAppCard />
      <div className="border border-neon/10 bg-abyss/40 px-3 py-2.5 text-[0.65rem] leading-relaxed text-neon-dim">
        <p className="mb-1 flex items-center gap-1.5 font-display text-[0.55rem] tracking-[0.2em] text-neon">
          <Copy className="size-3" /> EXAMPLE COMMANDS
        </p>
        “open google” · “play arijit singh on youtube” · “morning briefing” · “research AI chip market” ·
        “remember that my meeting is at 5pm” · “what do you remember about me?” · “/status”
      </div>
    </div>
  );
}

function AgentsTab() {
  const agents = useAppStore((s) => s.agents);
  const setAgentStatus = useAppStore((s) => s.setAgentStatus);
  const [building, setBuilding] = useState(false);

  const buildAgent = async () => {
    const name = window.prompt("New agent name (e.g. Zain):");
    if (!name?.trim()) return;
    const purpose = window.prompt(`What is ${name.trim()} for? (e.g. stock market analysis):`);
    if (!purpose?.trim()) return;
    setBuilding(true);
    try {
      const def = await createCustomAgent(name, purpose, useSettingsStore.getState());
      notify("success", `${def.codename} built — online in SUB AGENTS.`);
    } catch (e) {
      notify("error", `Agent build failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <button
        onClick={() => void buildAgent()}
        disabled={building}
        className="glass mb-2 flex w-full items-center justify-center gap-2 px-3 py-2 text-sm text-neon hover:bg-neon/10 disabled:opacity-50"
      >
        {building ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Build Custom Agent
      </button>

      {agents.map((a) => {
        const enabled = a.status === "active" || a.status === "processing";
        return (
          <div
            key={a.id}
            className="flex items-center gap-3 border border-neon/10 bg-abyss/50 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ice/90">
                <span className="text-neon">{a.codename}</span> · {a.name}
                {a.custom && (
                  <span className="ml-2 border border-amber-300/40 bg-amber-400/10 px-1.5 py-0.5 font-display text-[0.5rem] tracking-[0.15em] text-amber-200">
                    CUSTOM
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-neon-dim">{a.role}</p>
            </div>
            {a.custom && (
              <button
                onClick={() =>
                  window.confirm(`Delete custom agent ${a.codename}?`) &&
                  (deleteCustomAgent(a.id), notify("info", `${a.codename} decommissioned.`))
                }
                className="text-neon-dim hover:text-rose-300"
                title="Delete custom agent"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
            <span className={cn("font-display text-[0.55rem] tracking-[0.2em]", enabled ? "text-neon" : "text-slate-500")}>
              {enabled ? "ACTIVE" : "STANDBY"}
            </span>
            <Switch checked={enabled} onChange={(v) => setAgentStatus(a.id, v ? "active" : "standby")} />
          </div>
        );
      })}
    </div>
  );
}

/** Memory tab — "Cinem AI Assistant Remembers": view, add, delete, wipe. 100% local. */
function MemoryTab() {
  const [mems, setMems] = useState<MemoryEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => setMems(await allMemories());
  useEffect(() => {
    void reload();
  }, []);

  const add = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    await addMemory(draft.trim());
    setDraft("");
    await reload();
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border border-neon/30 bg-neon/[0.05] px-3 py-2.5 text-neon">
        <BrainCircuit className="size-5" />
        <div>
          <span className="font-display text-[0.7rem] font-bold tracking-[0.2em]">
            LONG-TERM MEMORY — {mems.length} FACTS
          </span>
          <p className="text-[0.65rem] font-normal tracking-normal text-neon-dim">
            100% local &amp; private. Vector search via Ollama (nomic-embed-text); keyword fallback when offline.
            Say “remember that …” anytime.
          </p>
        </div>
      </div>

      {/* add manually */}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
          placeholder="Add a fact… e.g. My wife's birthday is on 15th August"
          className="min-w-0 flex-1 border border-neon/20 bg-abyss/80 px-3 py-2 text-sm text-ice outline-none placeholder:text-neon-dim/60 focus:border-neon/50"
        />
        <button
          onClick={() => void add()}
          disabled={busy || !draft.trim()}
          className="glass flex items-center gap-1.5 px-3 py-2 text-sm text-neon hover:bg-neon/10 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Remember
        </button>
      </div>

      {/* memory list */}
      <div className="max-h-[44vh] space-y-1.5 overflow-y-auto pr-1">
        {mems.length === 0 && (
          <p className="py-6 text-center text-sm text-neon-dim">
            No memories yet. Tell Cinem AI Assistant: “remember that my office opens at 10am”.
          </p>
        )}
        {mems.map((m) => (
          <div
            key={m.id}
            className="group flex items-start gap-2.5 border border-neon/10 bg-abyss/50 px-3 py-2"
          >
            <span
              className={cn(
                "mt-1.5 size-1.5 shrink-0 rounded-full",
                m.embedding ? "bg-neon dot-active" : "bg-amber-300/80",
              )}
              title={m.embedding ? "Vector-indexed (semantic search)" : "Keyword-indexed (Ollama was offline)"}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ice/90">{m.text}</p>
              <p className="text-[0.6rem] tracking-wider text-neon-dim">{m.createdAt.slice(0, 10)}</p>
            </div>
            <button
              onClick={() => void deleteMemory(m.id).then(reload)}
              className="text-neon-dim opacity-0 transition-opacity hover:text-rose-300 group-hover:opacity-100"
              title="Forget this"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      {mems.length > 0 && (
        <button
          onClick={() =>
            window.confirm("Wipe ALL long-term memories? This cannot be undone.") &&
            void clearMemories().then(reload)
          }
          className="flex items-center gap-2 border border-rose-400/40 px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
        >
          <Trash2 className="size-4" /> Forget Everything
        </button>
      )}
    </div>
  );
}

function AccountTab() {
  const user = useUserStore((s) => s.user);
  const registerAgain = useUserStore((s) => s.registerAgain);
  const setOpen = useSettingsStore((s) => s.setOpen);

  if (!user) {
    return <p className="text-sm text-neon-dim">No local user record on this device.</p>;
  }

  const unlink = async () => {
    setOpen(false);
    await registerAgain(); // unbind device → back to registration
  };

  const rows: [string, string][] = [
    ["Name", user.name || "—"],
    ["Email", user.email || "—"],
    ["WhatsApp", user.whatsapp || "—"],
    ["Country", user.country || "—"],
    ["Status", user.status.toUpperCase()],
    ["Registered", new Date(user.requestedAt).toLocaleString()],
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border border-neon/30 bg-neon/[0.05] px-3 py-2.5 text-neon">
        <ShieldCheck className="size-5" />
        <span className="font-display text-[0.7rem] font-bold tracking-[0.2em]">
          LOCAL ACCOUNT — {user.status === "approved" ? "ACTIVE" : user.status.toUpperCase()}
        </span>
      </div>

      <div className="space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-neon/[0.08] py-1.5 text-sm">
            <span className="text-neon-dim">{k}</span>
            <span className="text-ice/90">{v}</span>
          </div>
        ))}
        {user.licenseKey && (
          <div className="py-1.5">
            <p className="text-sm text-neon-dim">License Key</p>
            <p className="mt-0.5 break-all font-mono text-xs text-neon">{user.licenseKey}</p>
          </div>
        )}
      </div>

      <p className="text-xs text-neon-dim/80">
        Your account lives entirely on this machine (cinem-ai-assistant-localdb.json). Manage approvals in
        the Admin Panel at <span className="font-mono text-ice/80">/admin</span>.
      </p>

      <button
        onClick={() => void unlink()}
        className="flex items-center gap-2 border border-rose-400/40 px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
      >
        <LogOut className="size-4" /> Unlink This Device
      </button>
    </div>
  );
}

function VisionControls() {
  const mode = useVisionStore((s) => s.mode);
  const enableCamera = useVisionStore((s) => s.enableCamera);
  const enableScreen = useVisionStore((s) => s.enableScreen);
  const disable = useVisionStore((s) => s.disable);

  return (
    <div className="border border-neon/10 bg-abyss/50 p-3">
      <p className="text-sm font-semibold text-ice/90">Vision (Camera & Screen)</p>
      <p className="mb-2.5 text-xs text-neon-dim">
        Let Cinem AI Assistant see through your camera or screen and answer "what is this?". Requires a
        vision model (Gemini key, or Ollama llava).
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void enableCamera().catch(() => undefined)}
          className={cn("glass flex items-center gap-2 px-3 py-1.5 text-sm",
            mode === "camera" ? "text-neon" : "text-ice/80 hover:text-neon")}
        >
          <Camera className="size-4" /> Enable Camera
        </button>
        <button
          onClick={() => void enableScreen().catch(() => undefined)}
          className={cn("glass flex items-center gap-2 px-3 py-1.5 text-sm",
            mode === "screen" ? "text-neon" : "text-ice/80 hover:text-neon")}
        >
          <MonitorUp className="size-4" /> Share Screen
        </button>
        {mode !== "off" && (
          <button
            onClick={disable}
            className="flex items-center gap-2 border border-rose-400/40 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-500/10"
          >
            Stop
          </button>
        )}
      </div>
    </div>
  );
}

/** Updates card — check, download, install, restart + Auto Update toggle. */
function UpdatesCard() {
  const s = useSettingsStore();
  const u = useUpdateStore();
  const busy = u.status === "checking" || u.status === "downloading";

  useEffect(() => subscribeToUpdates(), []);

  const statusLine = (() => {
    switch (u.status) {
      case "checking": return "Checking";
      case "none": return `Up to date${u.currentVersion ? ` (CINEM Pro ${u.currentVersion})` : ""}`;
      case "available": return `Update available${u.version ? ` — CINEM Pro ${u.version}` : ""}${u.currentVersion ? ` (current ${u.currentVersion})` : ""}`;
      case "downloading": return `Downloading${u.version ? ` ${u.version}` : ""}… ${Math.round(u.progress * 100)}%`;
      case "ready": return "Ready to restart";
      case "error": return u.error || "Error";
      default: return u.currentVersion ? `Current version ${u.currentVersion}` : "Auto Update checks on startup in the installed CINEM Pro app.";
    }
  })();

  return (
    <div className="border border-neon/10 bg-abyss/50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-ice/90">
            <DownloadCloud className="size-4 text-neon" /> Updates
          </p>
          <p className={cn("mt-0.5 text-xs", u.status === "error" ? "text-rose-300" : "text-neon-dim")}>
            {statusLine}
          </p>
        </div>

        {u.status === "available" ? (
          <button
            onClick={() => void downloadAndInstall()}
            className="flex shrink-0 items-center gap-2 border border-neon/50 bg-neon/15 px-3 py-1.5 text-xs font-semibold text-neon hover:bg-neon/25"
          >
            <DownloadCloud className="size-3.5" /> Download &amp; Install
          </button>
        ) : u.status === "ready" ? (
          <button
            onClick={() => void relaunchApp()}
            className="flex shrink-0 items-center gap-2 border border-emerald-400/50 bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/25"
          >
            <RotateCw className="size-3.5" /> Restart
          </button>
        ) : (
          <button
            onClick={() => void checkForUpdate()}
            disabled={busy}
            className="flex shrink-0 items-center gap-2 border border-neon/40 px-3 py-1.5 text-xs font-semibold text-neon hover:bg-neon/10 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCcw className="size-3.5" />}
            Check now
          </button>
        )}
      </div>

      {/* download progress bar */}
      {u.status === "downloading" && (
        <div className="mt-2.5 h-1.5 w-full overflow-hidden bg-abyss">
          <div
            className="h-full bg-neon shadow-[0_0_10px_rgba(var(--glow),0.7)] transition-all duration-300"
            style={{ width: `${Math.max(4, u.progress * 100)}%` }}
          />
        </div>
      )}

      {/* release notes */}
      {u.status === "available" && u.notes && (
        <p className="mt-2.5 max-h-24 overflow-y-auto border border-neon/10 bg-void/40 px-2.5 py-2 text-xs leading-relaxed text-ice/75 whitespace-pre-wrap">
          {u.notes}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-neon/[0.08] pt-2.5">
        <div>
          <p className="text-sm font-semibold text-ice/90">Auto Update</p>
          <p className="text-xs text-neon-dim">
            Download new versions automatically (restart stays manual). Portable builds cannot update in place.
          </p>
        </div>
        <Switch checked={s.autoUpdate} onChange={(v) => void setAutoUpdateEnabled(v)} />
      </div>
    </div>
  );
}

function GeneralTab() {
  const s = useSettingsStore();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-4">
      <UpdatesCard />

      <div className="flex items-center justify-between border border-neon/10 bg-abyss/50 px-3 py-3">
        <div>
          <p className="text-sm font-semibold text-ice/90">Always On Top</p>
          <p className="text-xs text-neon-dim">Keep Cinem AI Assistant above all other windows.</p>
        </div>
        <Switch checked={s.alwaysOnTop} onChange={(v) => s.update({ alwaysOnTop: v })} />
      </div>
      <div className="flex items-center justify-between border border-neon/10 bg-abyss/50 px-3 py-3">
        <div>
          <p className="text-sm font-semibold text-ice/90">Show Risk Radar</p>
          <p className="text-xs text-neon-dim">
            Sentinel's live threat radar in the Intelligence Hub (rescans every 8s).
          </p>
        </div>
        <Switch checked={s.showRadar} onChange={(v) => s.update({ showRadar: v })} />
      </div>
      <div className="flex items-center justify-between border border-neon/10 bg-abyss/50 px-3 py-3">
        <div>
          <p className="text-sm font-semibold text-ice/90">Auto-start at Login</p>
          <p className="text-xs text-neon-dim">Launch Cinem AI Assistant automatically when you sign in (Windows & macOS).</p>
        </div>
        <Switch checked={s.autoStart} onChange={(v) => s.update({ autoStart: v })} />
      </div>

      <VisionControls />

      <div className="border border-rose-400/25 bg-rose-500/5 p-3">
        <p className="text-sm font-semibold text-rose-300">Danger Zone</p>
        <p className="mb-2 text-xs text-neon-dim">
          Clears chat history and resets every setting to its default.
        </p>
        {confirming ? (
          <div className="flex gap-2">
            <button
              onClick={() => { s.reset(); setConfirming(false); }}
              className="flex items-center gap-2 border border-rose-400/50 bg-rose-500/15 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-500/25"
            >
              <Trash2 className="size-4" /> Confirm Reset
            </button>
            <button onClick={() => setConfirming(false)} className="glass px-3 py-1.5 text-sm text-ice">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="flex items-center gap-2 border border-rose-400/40 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-500/10"
          >
            <Trash2 className="size-4" /> Clear Memory / Reset
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Modal shell ──────────────────────────────────────────────────── */

/** Glassmorphism settings modal — API / Voice / Agents / General. */
export default function SettingsModal() {
  const open = useSettingsStore((s) => s.open);
  const setOpen = useSettingsStore((s) => s.setOpen);
  const [tab, setTab] = useState<Tab>("api");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
            className="glass flex h-[620px] w-[760px] max-w-[92vw] flex-col"
          >
            {/* Header */}
            <header className="flex shrink-0 items-center justify-between border-b border-neon/10 px-5 py-3">
              <h2 className="neon-text font-display text-sm font-bold tracking-[0.3em]">
                Cinem AI Assistant&nbsp;SETTINGS
              </h2>
              <button onClick={() => setOpen(false)} className="text-neon-dim hover:text-neon" aria-label="Close">
                <X className="size-5" />
              </button>
            </header>

            {/* Tabs */}
            <nav className="flex shrink-0 gap-1 border-b border-neon/10 px-4 pt-2">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex items-center gap-1.5 border-b-2 px-2 py-2 font-display text-[0.6rem] font-bold tracking-[0.1em] transition-colors",
                    tab === id
                      ? "border-neon text-neon"
                      : "border-transparent text-neon-dim hover:text-ice",
                  )}
                >
                  <Icon className="size-3.5" /> {label.toUpperCase()}
                </button>
              ))}
            </nav>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {tab === "api" && <ApiTab />}
              {tab === "appearance" && <AppearanceTab />}
              {tab === "voice" && <VoiceTab />}
              {tab === "agents" && <AgentsTab />}
              {tab === "memory" && <MemoryTab />}
              {tab === "remote" && <RemoteTab />}
              {tab === "account" && <AccountTab />}
              {tab === "general" && <GeneralTab />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
