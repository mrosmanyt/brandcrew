/**
 * Cinem AI Assistant Auto-Pilot (Phase 4) — drives the one-command factory and the
 * 30-day "1 video/day" campaign.
 *
 *  • runOnce(topic)            — full chain right now (script→…→upload)
 *  • startCampaign(niche)      — plan 30 topics, then auto-run 1/day at runTime
 *  • The scheduler tick fires daily: picks the next pending day, runs the
 *    factory, persists the result. Survives app restarts (state is persisted).
 */
import { create } from "zustand";
import { runFactory, type FactoryStage } from "@/lib/factory";
import { suggestTrending } from "@/lib/scriptStudio";
import { useSettingsStore } from "@/store/useSettingsStore";
import { notify } from "@/store/useToastStore";
import type { Platform } from "@/lib/uploader";
import type { EditStyle } from "@/lib/nova";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const LS_KEY = "cinem-ai-assistant-autopilot";

export type DayStatus = "pending" | "running" | "done" | "failed";

export interface DayJob {
  day: number;            // 1..N
  topic: string;
  status: DayStatus;
  ranAt?: string;         // YYYY-MM-DD when it actually ran
  video?: string;
  error?: string;
}

export interface Campaign {
  niche: string;
  createdAt: number;
  days: number;           // total days (30)
  runTime: string;        // "HH:MM" 24h — daily trigger time
  platforms: Platform[];
  style: EditStyle;
  jobs: DayJob[];
  active: boolean;        // false = paused / finished
}

interface RunProgress {
  busy: boolean;
  stage: FactoryStage | "idle";
  message: string;
  video?: string;
}

interface AutopilotState {
  open: boolean;
  campaign: Campaign | null;
  run: RunProgress;
  lastError: string;

  setOpen: (v: boolean) => void;

  /** Full chain for a single topic, right now. Returns a chat reply. */
  runOnce: (topic: string, platforms?: Platform[]) => Promise<string>;

  /** Plan a 30-day campaign for a niche and arm the daily scheduler. */
  startCampaign: (
    niche: string,
    opts?: { days?: number; runTime?: string; platforms?: Platform[]; style?: EditStyle },
  ) => Promise<string>;

  pause: () => void;
  resume: () => void;
  cancel: () => void;

  /** Called by the scheduler tick (and on boot). Runs a due day if it's time. */
  tick: () => Promise<void>;

  /** Force-run the next pending day immediately (manual "run today now"). */
  runNextNow: () => Promise<string>;

  _load: () => void;
}

/* ── persistence (Tauri store or localStorage) ─────────────────────── */
function persist(campaign: Campaign | null) {
  try {
    if (IS_TAURI) {
      void import("@tauri-apps/plugin-store").then(async (m) => {
        const load = m.load as unknown as (p: string, o?: unknown) => Promise<{
          set(k: string, v: unknown): Promise<void>; save(): Promise<void>;
        }>;
        const st = await load("cinem-ai-assistant-autopilot.json", { defaults: {} });
        await st.set("campaign", campaign);
        await st.save();
      });
    } else {
      if (campaign) localStorage.setItem(LS_KEY, JSON.stringify(campaign));
      else localStorage.removeItem(LS_KEY);
    }
  } catch { /* non-fatal */ }
}

const today = () => new Date().toISOString().slice(0, 10);
const nowHM = () => new Date().toTimeString().slice(0, 5);

/** Plan N topics for a niche (calls suggestTrending in batches, dedupes/pads). */
async function planTopics(niche: string, n: number): Promise<string[]> {
  const s = useSettingsStore.getState();
  const seen = new Set<string>();
  const out: string[] = [];
  for (let tries = 0; tries < 8 && out.length < n; tries++) {
    let batch: string[] = [];
    try { batch = await suggestTrending(niche, s); } catch { batch = []; }
    for (const t of batch) {
      const key = t.trim().toLowerCase();
      if (t.trim() && !seen.has(key)) { seen.add(key); out.push(t.trim()); }
      if (out.length >= n) break;
    }
    if (!batch.length) break;
  }
  // Pad if the LLM gave fewer than n unique ideas.
  while (out.length < n) out.push(`${niche || "Trending"} — idea ${out.length + 1}`);
  return out.slice(0, n);
}

let scheduler: ReturnType<typeof setInterval> | null = null;

export const useAutopilotStore = create<AutopilotState>((set, get) => ({
  open: false,
  campaign: null,
  run: { busy: false, stage: "idle", message: "" },
  lastError: "",

  setOpen: (v) => set({ open: v }),

  runOnce: async (topic, platforms) => {
    if (get().run.busy) return "Ek video already ban rahi hai — wait karein.";
    set({ open: true, run: { busy: true, stage: "script", message: "Shuru…" } });
    const res = await runFactory(
      { topic, platforms, style: "high", autoUpload: true },
      (p) => set({ run: { busy: true, stage: p.stage, message: p.message, video: p.video } }),
    );
    set({ run: { busy: false, stage: res.ok ? "done" : "error", message: res.error || "Done", video: res.video } });
    if (res.ok) {
      notify("success", `Video ready: ${res.title}`);
      return `✅ Pura ho gaya — "${res.title}"\nVideo: ${res.video}\n${res.uploadSummary || ""}`.trim();
    }
    notify("error", `Factory ruki (${res.failedStage}): ${res.error}`);
    return `⚠️ Chain ${res.failedStage} par ruki: ${res.error}`;
  },

  startCampaign: async (niche, opts) => {
    const days = opts?.days ?? 30;
    const runTime = opts?.runTime ?? "10:00";
    const platforms = opts?.platforms ?? (["youtube"] as Platform[]);
    const style = opts?.style ?? "high";
    if (!useSettingsStore.getState().clipsFolder)
      return "Pehle Settings → NOVA mein clips folder set karein.";

    set({ open: true, run: { busy: true, stage: "script", message: `${days} topics plan kar raha hoon…` } });
    const topics = await planTopics(niche, days);
    const campaign: Campaign = {
      niche, createdAt: Date.now(), days, runTime, platforms, style,
      active: true,
      jobs: topics.map((topic, i) => ({ day: i + 1, topic, status: "pending" as DayStatus })),
    };
    set({ campaign, run: { busy: false, stage: "idle", message: "" } });
    persist(campaign);
    notify("success", `Auto-Pilot armed — ${days} din, roz ${runTime} baje 1 video.`);
    // Kick the scheduler and try today immediately if the time has passed.
    startScheduler(get);
    void get().tick();
    return `🚀 30-din Auto-Pilot set: niche "${niche}", roz ${runTime} baje 1 video → ${platforms.join(", ")}. Pehla topic: "${topics[0]}".`;
  },

  pause: () => {
    const c = get().campaign; if (!c) return;
    const next = { ...c, active: false };
    set({ campaign: next }); persist(next);
    notify("info", "Auto-Pilot paused.");
  },

  resume: () => {
    const c = get().campaign; if (!c) return;
    const next = { ...c, active: true };
    set({ campaign: next }); persist(next);
    startScheduler(get);
    void get().tick();
    notify("info", "Auto-Pilot resumed.");
  },

  cancel: () => {
    set({ campaign: null });
    persist(null);
    if (scheduler) { clearInterval(scheduler); scheduler = null; }
    notify("info", "Auto-Pilot campaign cancel ho gaya.");
  },

  tick: async () => {
    const c = get().campaign;
    if (!c || !c.active || get().run.busy) return;
    // One run per calendar day.
    const alreadyToday = c.jobs.some((j) => j.ranAt === today());
    if (alreadyToday) return;
    if (nowHM() < c.runTime) return;             // not time yet
    const next = c.jobs.find((j) => j.status === "pending");
    if (!next) {                                 // campaign complete
      const fin = { ...c, active: false };
      set({ campaign: fin }); persist(fin);
      notify("success", "🎉 30-din Auto-Pilot complete!");
      return;
    }
    await runDay(get, set, next.day);
  },

  runNextNow: async () => {
    const c = get().campaign;
    if (!c) return "Koi campaign active nahi hai.";
    if (get().run.busy) return "Already busy.";
    const next = c.jobs.find((j) => j.status === "pending");
    if (!next) return "Saare din complete ho chuke hain.";
    await runDay(get, set, next.day);
    return `Day ${next.day} run shuru: "${next.topic}".`;
  },

  _load: () => {
    if (get().campaign) return;
    const apply = (c: Campaign | null) => {
      if (c) { set({ campaign: c }); if (c.active) { startScheduler(get); void get().tick(); } }
    };
    try {
      if (IS_TAURI) {
        void import("@tauri-apps/plugin-store").then(async (m) => {
          const load = m.load as unknown as (p: string, o?: unknown) => Promise<{ get<T>(k: string): Promise<T | undefined> }>;
          const st = await load("cinem-ai-assistant-autopilot.json", { defaults: {} });
          apply((await st.get<Campaign>("campaign")) ?? null);
        });
      } else {
        const raw = localStorage.getItem(LS_KEY);
        apply(raw ? (JSON.parse(raw) as Campaign) : null);
      }
    } catch { /* ignore */ }
  },
}));

/* ── helpers that mutate the campaign during a run ─────────────────── */
type Get = () => AutopilotState;
type Set = (p: Partial<AutopilotState>) => void;

async function runDay(get: Get, set: Set, day: number) {
  const c = get().campaign;
  if (!c) return;
  const patchJob = (u: Partial<DayJob>) => {
    const cur = get().campaign;
    if (!cur) return;
    const jobs = cur.jobs.map((j) => (j.day === day ? { ...j, ...u } : j));
    const next = { ...cur, jobs };
    set({ campaign: next }); persist(next);
  };

  const job = c.jobs.find((j) => j.day === day);
  if (!job) return;
  patchJob({ status: "running", ranAt: today() });
  set({ run: { busy: true, stage: "script", message: `Day ${day}: ${job.topic}` } });

  const res = await runFactory(
    { topic: job.topic, platforms: c.platforms, style: c.style, autoUpload: true },
    (p) => set({ run: { busy: true, stage: p.stage, message: `Day ${day} · ${p.message}`, video: p.video } }),
  );

  if (res.ok) {
    patchJob({ status: "done", video: res.video });
    notify("success", `Day ${day} video ready: ${res.title}`);
  } else {
    patchJob({ status: "failed", error: res.error });
    notify("error", `Day ${day} ruki (${res.failedStage}): ${res.error}`);
  }
  set({ run: { busy: false, stage: res.ok ? "done" : "error", message: res.error || "Done", video: res.video } });
}

function startScheduler(get: Get) {
  if (scheduler) return;
  // Check every minute whether a day is due.
  scheduler = setInterval(() => { void get().tick(); }, 60_000);
}
