/**
 * Live news for the "Today Headlines" sidebar.
 *
 * Primary : Google News RSS (real, current, worldwide headlines).
 * Fallback: Hacker News Algolia API (CORS-friendly — keeps plain-browser
 *           `npm run dev` working, where Google RSS is blocked by CORS).
 *
 * In the desktop build, tauri-plugin-http bypasses CORS entirely (the news
 * domains are allow-listed in src-tauri/capabilities/default.json).
 */
const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface Headline {
  title: string;
  source: string;
  url: string;
  publishedAt: number; // epoch ms
  tag: string;         // FINANCE / TECH / WORLD / SCIENCE …
}

async function doFetch(url: string): Promise<Response> {
  const f = IS_TAURI ? (await import("@tauri-apps/plugin-http")).fetch : window.fetch.bind(window);
  return f(url);
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
    };
  });
}

/** Fetches real, current headlines (Google News → HN fallback). */
export async function fetchHeadlines(limit = 5): Promise<Headline[]> {
  try {
    const items = await fromGoogleNews(limit);
    if (items.length) return items;
    throw new Error("empty feed");
  } catch (e) {
    console.warn("[news] Google News unavailable, falling back to Hacker News:", e);
    return fromHackerNews(limit);
  }
}

/** "3h ago" style relative time. */
export function timeAgo(epochMs: number): string {
  const s = Math.max(0, (Date.now() - epochMs) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
