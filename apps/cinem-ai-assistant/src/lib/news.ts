/**
 * Live news for Today Headlines + World Monitor — Live.
 *
 * Primary : World Monitor digest (when a wm_… key is set — Settings or
 *           WORLD_MONITOR_API_KEY). Official geopolitics/OSINT feed.
 * Secondary: Google News RSS.
 * Fallback : Hacker News Algolia (CORS-friendly for plain `npm run dev`).
 *
 * In the Electron shell, fetches go through main-process IPC (no renderer CORS).
 */
import { desktopHttpGet, isCinemElectron } from "@/lib/desktop-shell";
import { useSettingsStore } from "@/store/useSettingsStore";
import { parseWorldMonitorDigest, worldMonitorTag, WORLD_MONITOR_DIGEST_URL } from "@/lib/world-monitor";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface Headline {
  title: string;
  source: string;
  url: string;
  publishedAt: number; // epoch ms
  tag: string;         // FINANCE / TECH / WORLD / SCIENCE …
  via?: "worldmonitor" | "google" | "hn";
}

export type HeadlineSource = "worldmonitor" | "google" | "hn" | "none";

export interface HeadlineResult {
  items: Headline[];
  source: HeadlineSource;
  setupHint?: string;
}

function worldMonitorKey(): string {
  return String(useSettingsStore.getState().worldMonitorKey || "").trim();
}

async function doFetch(url: string, opts?: { worldMonitorKey?: string }): Promise<Response> {
  if (isCinemElectron()) {
    const r = await desktopHttpGet(url, opts);
    return new Response(r.text, { status: r.status || (r.ok ? 200 : 502) });
  }
  if (IS_TAURI) {
    return (await import("@tauri-apps/plugin-http")).fetch(url);
  }
  const headers: Record<string, string> = {};
  if (opts?.worldMonitorKey) headers["X-WorldMonitor-Key"] = opts.worldMonitorKey;
  return window.fetch(url, { headers });
}

/** Rough topic classifier so each headline gets a category chip. */
function classify(title: string): string {
  const t = title.toLowerCase();
  if (/\b(ai|artificial intelligence|chip|software|apple|google|microsoft|tech|robot|cyber|crypto|app)\b/.test(t)) return "TECH";
  if (/\b(market|stock|economy|inflation|bank|finance|trade|dollar|oil|price)\b/.test(t)) return "FINANCE";
  if (/\b(study|science|space|nasa|quantum|climate|research|vaccine|health)\b/.test(t)) return "SCIENCE";
  if (/\b(cup|league|match|olympic|tournament|champion)\b/.test(t)) return "SPORT";
  return "WORLD";
}

async function fromWorldMonitor(limit: number): Promise<Headline[]> {
  const key = worldMonitorKey();
  const res = await doFetch(WORLD_MONITOR_DIGEST_URL, { worldMonitorKey: key });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body.slice(0, 180) || `World Monitor ${res.status}`);
  }
  const parsed = parseWorldMonitorDigest(JSON.parse(await res.text()));
  return parsed.slice(0, limit).map((item) => ({
    title: item.title,
    source: item.source,
    url: item.link || WORLD_MONITOR_DIGEST_URL,
    publishedAt: item.publishedAt,
    tag: worldMonitorTag(item.category) || classify(item.title),
    via: "worldmonitor",
  }));
}

/** Google News RSS → Headline[] (title format: "Headline - Source"). */
async function fromGoogleNews(limit: number): Promise<Headline[]> {
  const res = await doFetch("https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en");
  if (!res.ok) throw new Error(`Google News ${res.status}`);
  const xml = new DOMParser().parseFromString(await res.text(), "text/xml");
  if (xml.querySelector("parsererror")) throw new Error("RSS parse failed");

  return [...xml.querySelectorAll("item")].slice(0, limit).map((item) => {
    const rawTitle = item.querySelector("title")?.textContent ?? "Untitled";
    const source =
      item.querySelector("source")?.textContent ??
      rawTitle.split(" - ").pop() ??
      "News";
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const title = rawTitle.replace(new RegExp(`\\s*-\\s*${escaped}\\s*$`), "");
    const pub = item.querySelector("pubDate")?.textContent;
    return {
      title,
      source,
      url: item.querySelector("link")?.textContent ?? "",
      publishedAt: pub ? Date.parse(pub) : Date.now(),
      tag: classify(title),
      via: "google" as const,
    };
  });
}

/** Hacker News front page → Headline[] (CORS-friendly fallback). */
async function fromHackerNews(limit: number): Promise<Headline[]> {
  const res = await doFetch(`https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${limit}`);
  if (!res.ok) throw new Error(`HN API ${res.status}`);
  const data = (await res.json()) as {
    hits: { title: string; url: string | null; objectID: string; created_at: string }[];
  };
  return data.hits.map((h) => {
    const url = h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`;
    let source = "Hacker News";
    try {
      source = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      /* keep default */
    }
    return {
      title: h.title,
      source,
      url,
      publishedAt: Date.parse(h.created_at),
      tag: classify(h.title),
      via: "hn" as const,
    };
  });
}

export async function fetchHeadlineResult(limit = 5): Promise<HeadlineResult> {
  const key = worldMonitorKey();
  // Electron main also attaches WORLD_MONITOR_API_KEY from the process env.
  if (key || isCinemElectron()) {
    try {
      const items = await fromWorldMonitor(limit);
      if (items.length) return { items, source: "worldmonitor" };
    } catch (e) {
      console.warn("[news] World Monitor digest unavailable:", e);
      if (key) {
        // Key was set but rejected — keep going with public feeds + setup hint.
        const fallback = await fetchPublicHeadlines(limit);
        return {
          ...fallback,
          setupHint:
            "World Monitor key was refused. Check Settings → API, or generate a new wm_… key on worldmonitor.app.",
        };
      }
    }
  }
  return fetchPublicHeadlines(limit);
}

async function fetchPublicHeadlines(limit: number): Promise<HeadlineResult> {
  try {
    const items = await fromGoogleNews(limit);
    if (items.length) return { items, source: "google" };
    throw new Error("empty feed");
  } catch (e) {
    console.warn("[news] Google News unavailable, falling back to Hacker News:", e);
    const items = await fromHackerNews(limit);
    return { items, source: items.length ? "hn" : "none" };
  }
}

/** Fetches real, current headlines (World Monitor → Google News → HN). */
export async function fetchHeadlines(limit = 5): Promise<Headline[]> {
  const result = await fetchHeadlineResult(limit);
  return result.items;
}

/** "3h ago" style relative time. */
export function timeAgo(epochMs: number): string {
  const s = Math.max(0, (Date.now() - epochMs) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
