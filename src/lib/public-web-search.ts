/**
 * Key-free public web search (DuckDuckGo HTML). Used when Tavily is not Connected
 * so research jobs still search → read → answer instead of dying after Google.
 */

export type PublicWebHit = {
  title: string;
  url: string;
  snippet: string;
};

export function duckDuckGoHtmlUrl(query: string): string {
  return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query.trim())}`;
}

export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`;
}

export function youtubeWatchUrl(videoId: string, autoplay = true): string {
  const id = String(videoId).replace(/[^\w-]/g, "");
  return `https://www.youtube.com/watch?v=${id}${autoplay ? "&autoplay=1" : ""}`;
}

export function youtubeEmbedSearchUrl(query: string): string {
  return (
    "https://www.youtube.com/embed?listType=search&list=" +
    `${encodeURIComponent(query.trim())}&autoplay=1`
  );
}

const YT_ID = /(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([\w-]{11})/;

export function youtubeVideoIdFromUrl(url: string): string | null {
  const match = String(url || "").match(YT_ID);
  return match?.[1] || null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/gi, " ");
}

export function unwrapDuckDuckGoUrl(href: string): string {
  try {
    const u = new URL(href, "https://duckduckgo.com");
    const uddg = u.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    return u.toString();
  } catch {
    return href;
  }
}

export function parseDuckDuckGoHits(html: string, max = 8): PublicWebHit[] {
  const hits: PublicWebHit[] = [];
  const seen = new Set<string>();
  const blockRe =
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) && hits.length < max) {
    const url = unwrapDuckDuckGoUrl(m[1]);
    const title = decodeEntities(m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (!url.startsWith("http") || seen.has(url) || !title) continue;
    seen.add(url);
    hits.push({ title, url, snippet: "" });
  }
  const snips = [...html.matchAll(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td|div)>/gi)];
  snips.slice(0, hits.length).forEach((s, i) => {
    if (hits[i]) {
      hits[i].snippet = decodeEntities(s[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(
        0,
        280,
      );
    }
  });
  return hits;
}

export function formatPublicSearchText(
  query: string,
  hits: PublicWebHit[],
  pages: Array<{ url: string; text: string }> = [],
): string {
  const lines = [`Query: ${query}`];
  for (const hit of hits) {
    lines.push(`## ${hit.title}\n${hit.url}\n${hit.snippet}`);
  }
  for (const page of pages) {
    if (!page.text.trim()) continue;
    lines.push(`## Page ${page.url}\n${page.text.slice(0, 1800)}`);
  }
  return lines.join("\n\n").slice(0, 12_000);
}

export async function duckDuckGoSearch(query: string): Promise<{
  ok: boolean;
  query: string;
  text: string;
  hits: PublicWebHit[];
  error?: string;
}> {
  const q = query.trim();
  if (!q) return { ok: false, query: q, text: "", hits: [], error: "No search query." };
  try {
    const res = await fetch(duckDuckGoHtmlUrl(q), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: "text/html,text/plain;q=0.9,*/*;q=0.1",
        "User-Agent": "CINEM-Pro-Research/0.2 (+https://github.com/mrosmanyt/brandcrew)",
      },
    });
    const html = await res.text();
    const hits = parseDuckDuckGoHits(html, 8);
    if (!hits.length) {
      return {
        ok: false,
        query: q,
        text: "",
        hits: [],
        error: res.ok ? "No public search hits." : `Search HTTP ${res.status}`,
      };
    }
    return {
      ok: true,
      query: q,
      text: formatPublicSearchText(q, hits),
      hits,
    };
  } catch (error) {
    return {
      ok: false,
      query: q,
      text: "",
      hits: [],
      error: error instanceof Error ? error.message : "Search failed.",
    };
  }
}
