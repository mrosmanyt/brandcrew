/**
 * Cinem AI Assistant Long-Term Memory — "Cinem AI Assistant Remembers". 100% local & private.
 *
 * Storage  : tauri-plugin-store file `cinem-ai-assistant-memory.json` (localStorage in
 *            browser dev). Nothing ever leaves the machine.
 * Semantics: Ollama embeddings (`nomic-embed-text`, local) → cosine search.
 *            If Ollama isn't running, memories are still saved and searched
 *            with a keyword-overlap fallback — memory never breaks.
 * Usage    : explicit ("Remember that …") + automatic — the top matching
 *            memories are injected into every LLM conversation.
 */
import { useSettingsStore } from "@/store/useSettingsStore";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const STORE_FILE = "cinem-ai-assistant-memory.json";
const LS_KEY = "cinem-ai-assistant-memory";
const MAX_MEMORIES = 500;
const EMBED_MODEL = "nomic-embed-text";

export interface MemoryEntry {
  id: string;
  text: string;
  createdAt: string; // ISO
  /** null = embedding unavailable when saved (keyword search still works). */
  embedding: number[] | null;
}

/* ── Persistence ──────────────────────────────────────────────────── */

type TauriStore = {
  get<T>(k: string): Promise<T | undefined>;
  set(k: string, v: unknown): Promise<void>;
  save(): Promise<void>;
};
let store: TauriStore | null = null;

async function load(): Promise<MemoryEntry[]> {
  if (IS_TAURI) {
    if (!store) {
      const mod = await import("@tauri-apps/plugin-store");
      const loadFn = mod.load as unknown as (p: string, o?: unknown) => Promise<TauriStore>;
      store = await loadFn(STORE_FILE, { defaults: {} });
    }
    return (await store.get<MemoryEntry[]>("memories")) ?? [];
  }
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as MemoryEntry[];
  } catch {
    return [];
  }
}

async function save(mem: MemoryEntry[]): Promise<void> {
  if (IS_TAURI && store) {
    await store.set("memories", mem);
    await store.save();
  } else {
    localStorage.setItem(LS_KEY, JSON.stringify(mem));
  }
}

/* ── Embeddings (Ollama, local) ───────────────────────────────────── */

async function embed(text: string): Promise<number[] | null> {
  try {
    const s = useSettingsStore.getState();
    const doFetch = IS_TAURI
      ? (await import("@tauri-apps/plugin-http")).fetch
      : window.fetch.bind(window);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await doFetch(`${s.ollamaUrl.replace(/\/$/, "")}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { embedding?: number[] };
    return data.embedding?.length ? data.embedding : null;
  } catch {
    return null; // Ollama not running — keyword fallback covers us
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

const tokens = (t: string) =>
  new Set(t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2));

function keywordScore(query: string, text: string): number {
  const q = tokens(query);
  const t = tokens(text);
  if (!q.size) return 0;
  let hit = 0;
  for (const w of q) if (t.has(w)) hit++;
  return hit / q.size;
}

/* ── Public API ───────────────────────────────────────────────────── */

/** Saves a fact to long-term memory. Returns the entry. */
export async function addMemory(text: string): Promise<MemoryEntry> {
  const mem = await load();
  const entry: MemoryEntry = {
    id: crypto.randomUUID(),
    text: text.trim(),
    createdAt: new Date().toISOString(),
    embedding: await embed(text),
  };
  await save([entry, ...mem].slice(0, MAX_MEMORIES));
  console.log(`[Cinem AI Assistant memory] saved (${entry.embedding ? "vector" : "keyword"}): ${entry.text}`);
  return entry;
}

/** Top-k relevant memories for a query (vector when possible). */
export async function searchMemory(query: string, k = 5): Promise<MemoryEntry[]> {
  const mem = await load();
  if (!mem.length) return [];
  const qEmb = await embed(query);
  const scored = mem.map((m) => ({
    m,
    score:
      qEmb && m.embedding ? cosine(qEmb, m.embedding) : keywordScore(query, m.text) * 0.8,
  }));
  const cutoff = qEmb ? 0.35 : 0.25;
  return scored
    .filter((x) => x.score >= cutoff)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.m);
}

export const allMemories = load;

export async function deleteMemory(id: string): Promise<void> {
  await save((await load()).filter((m) => m.id !== id));
}

export async function clearMemories(): Promise<void> {
  await save([]);
}

/**
 * Prompt block of relevant memories for the current request — injected into
 * every LLM conversation so Cinem AI Assistant uses what it knows automatically.
 */
export async function memoryContext(query: string): Promise<string> {
  try {
    const hits = await searchMemory(query, 5);
    if (!hits.length) return "";
    return (
      "\n\nKNOWN FACTS ABOUT THE USER (from long-term memory — use naturally when relevant, don't recite):\n" +
      hits.map((h) => `- ${h.text} (noted ${h.createdAt.slice(0, 10)})`).join("\n")
    );
  } catch {
    return "";
  }
}
