/**
 * Local reminders — persisted JSON + Notification API.
 * OS-level Task Scheduler integration is a follow-up.
 */
const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const STORE_FILE = "cinem-ai-assistant-reminders.json";
const LS_KEY = "cinem-ai-assistant-reminders";

export type Reminder = {
  id: string;
  text: string;
  at: string; // ISO
  createdAt: string;
  fired?: boolean;
};

type TauriStore = {
  get<T>(k: string): Promise<T | undefined>;
  set(k: string, v: unknown): Promise<void>;
  save(): Promise<void>;
};
let store: TauriStore | null = null;

async function load(): Promise<Reminder[]> {
  if (IS_TAURI) {
    if (!store) {
      const mod = await import("@tauri-apps/plugin-store");
      const loadFn = mod.load as unknown as (p: string, o?: unknown) => Promise<TauriStore>;
      store = await loadFn(STORE_FILE, { defaults: {} });
    }
    return (await store.get<Reminder[]>("items")) ?? [];
  }
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as Reminder[];
  } catch {
    return [];
  }
}

async function save(items: Reminder[]): Promise<void> {
  if (IS_TAURI && store) {
    await store.set("items", items);
    await store.save();
  } else {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  }
}

function parseDuration(text: string): number | null {
  const t = text.toLowerCase();
  const inM = t.match(/\bin\s+(\d+)\s*(minute|min|minutes|mins|hour|hours|hr|hrs|day|days)\b/);
  if (inM) {
    const n = Number(inM[1]);
    const unit = inM[2];
    if (/hour|hr/.test(unit)) return n * 3600_000;
    if (/day/.test(unit)) return n * 86400_000;
    return n * 60_000;
  }
  const atM = t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (atM) {
    let h = Number(atM[1]);
    const min = Number(atM[2] || 0);
    const ap = atM[3]?.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    const d = new Date();
    d.setHours(h, min, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    return d.getTime() - Date.now();
  }
  return null;
}

export function parseReminderCreate(text: string): { text: string; ms: number } | null {
  const t = text.trim();
  const m =
    t.match(/^remind me(?:\s+to)?\s+(.+)$/i) ||
    t.match(/^set a reminder(?:\s+to|\s+for)?\s+(.+)$/i) ||
    t.match(/^(.+?)\s+yaad\s+dila(?:na|o|en)?\s*$/i);
  if (!m) return null;
  let body = m[1].trim();
  const ms = parseDuration(body);
  if (ms == null || ms < 30_000) return null;
  body = body
    .replace(/\bin\s+\d+\s*(?:minute|min|minutes|mins|hour|hours|hr|hrs|day|days)\b/i, "")
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!body) body = "Reminder";
  return { text: body, ms };
}

export function isListRemindersCommand(text: string): boolean {
  return /\b(list|show|my)\s+reminders?\b/i.test(text) || /^reminders?\s*$/i.test(text.trim());
}

export function parseReminderCancel(text: string): string | null {
  const m = text.match(/\b(?:cancel|delete|remove)\s+reminder\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export async function createReminder(text: string, msFromNow: number): Promise<Reminder> {
  const items = await load();
  const entry: Reminder = {
    id: crypto.randomUUID(),
    text,
    at: new Date(Date.now() + msFromNow).toISOString(),
    createdAt: new Date().toISOString(),
  };
  await save([entry, ...items].slice(0, 100));
  return entry;
}

export async function listReminders(): Promise<Reminder[]> {
  return (await load()).filter((r) => !r.fired).sort((a, b) => a.at.localeCompare(b.at));
}

export async function cancelReminder(idOrText: string): Promise<boolean> {
  const items = await load();
  const needle = idOrText.toLowerCase();
  const next = items.filter(
    (r) => r.id !== idOrText && !r.text.toLowerCase().includes(needle),
  );
  if (next.length === items.length) return false;
  await save(next);
  return true;
}

async function notifyReminder(r: Reminder) {
  const title = "Cinem AI Assistant";
  const body = r.text;
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, { body });
  }
  try {
    const { notify } = await import("@/store/useToastStore");
    notify("info", `Reminder: ${body}`);
  } catch {
    /* optional */
  }
  try {
    const { speakQueued } = await import("@/lib/announcer");
    void speakQueued(`Reminder, Sir: ${body}`);
  } catch {
    /* optional */
  }
  try {
    const { useAppStore } = await import("@/store/useAppStore");
    useAppStore.getState().addMessage({ role: "assistant", text: `⏰ Reminder: ${body}` });
  } catch {
    /* optional */
  }
}

let schedulerStarted = false;

/** Poll due reminders — call once at app boot. */
export function initReminderScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    void Notification.requestPermission();
  }

  setInterval(async () => {
    const items = await load();
    const now = Date.now();
    let changed = false;
    for (const r of items) {
      if (r.fired) continue;
      if (new Date(r.at).getTime() <= now) {
        r.fired = true;
        changed = true;
        void notifyReminder(r);
      }
    }
    if (changed) await save(items);
  }, 15_000);
}

export function formatReminderList(items: Reminder[]): string {
  if (!items.length) return "No active reminders, Sir.";
  return items
    .map((r) => {
      const when = new Date(r.at).toLocaleString([], {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `- ${r.text} — ${when} (id: ${r.id.slice(0, 8)})`;
    })
    .join("\n");
}
