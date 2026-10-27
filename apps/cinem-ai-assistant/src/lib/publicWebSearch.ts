/**
 * Key-free public web search for the Windows assistant.
 * DuckDuckGo HTML is scrapeable; Google SERPs are not (consent + JS).
 */
import { duckDuckGoSearchUrl, youtubeVideoIdFromUrl } from "@/lib/browserIntents";

export type WebHit = {
  title: string;
  url: string;
  snippet: string;
};

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function httpGet(url: string, timeoutMs = 10_000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const doFetch = IS_TAURI
      ? (await import("@tauri-apps/plugin-http")).fetch
      : window.fetch.bind(window);
    const res = await doFetch(url, {
      method: "GET",
      signal: ctrl.signal,
      headers: {
        Accept: "text/html,text/plain;q=0.9,*/*;q=0.1",
        "User-Agent": "CINEM-Pro-Assistant/0.3 (+https://app.cinem.pro)",
      },
    });
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
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

function unwrapDdgUrl(href: string): string {
  try {
    const u = new URL(href, "https://duckduckgo.com");
    const uddg = u.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    return u.toString();
  } catch {
    return href;
  }
}

/** Parses DuckDuckGo HTML (and similar result lists). Exported for tests. */
export function parseSearchHits(html: string, max = 8): WebHit[] {
  const hits: WebHit[] = [];
  const seen = new Set<string>();
  const blockRe =
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) && hits.length < max) {
    const url = unwrapDdgUrl(m[1]);
    const title = decodeEntities(m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (!url.startsWith("http") || seen.has(url) || !title) continue;
    seen.add(url);
    hits.push({ title, url, snippet: "" });
  }
  if (hits.length) {
    const snips = [...html.matchAll(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td|div)>/gi)];
    snips.slice(0, hits.length).forEach((s, i) => {
      if (hits[i]) {
        hits[i].snippet = decodeEntities(s[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 280);
      }
    });
    return hits;
  }
  const generic = [...html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  for (const row of generic) {
    if (hits.length >= max) break;
    const url = unwrapDdgUrl(row[1]);
    if (/duckduckgo\.com|google\.com\/search/i.test(url)) continue;
    const title = decodeEntities(row[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (!title || title.length < 3 || seen.has(url)) continue;
    seen.add(url);
    hits.push({ title: title.slice(0, 160), url, snippet: "" });
  }
  return hits;
}

export async function searchPublicWeb(query: string, max = 6): Promise<WebHit[]> {
  const q = query.trim();
  if (!q) return [];
  const html = await httpGet(duckDuckGoSearchUrl(q));
  return parseSearchHits(html, max);
}

export async function fetchPageText(url: string, maxChars = 4000): Promise<{ url: string; ok: boolean; text: string }> {
  try {
    const html = await httpGet(url, 8000);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxChars);
    return { url, ok: Boolean(text), text };
  } catch (error) {
    return {
      url,
      ok: false,
      text: error instanceof Error ? error.message : "Fetch failed",
    };
  }
}

export async function searchYouTubeViaWeb(query: string, max = 6): Promise<{ id: string; title: string; url: string }[]> {
  const hits = await searchPublicWeb(`site:youtube.com ${query}`, max + 4);
  const out: { id: string; title: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const id = youtubeVideoIdFromUrl(hit.url);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, title: hit.title.replace(/\s*-\s*YouTube\s*$/i, ""), url: hit.url });
    if (out.length >= max) break;
  }
  return out;
}

export function formatHitsForPrompt(hits: WebHit[], pages: { url: string; text: string }[] = []): string {
  const list = hits
    .map((h, i) => `${i + 1}. ${h.title}\n   ${h.url}\n   ${h.snippet}`)
    .join("\n");
  const bodies = pages
    .filter((p) => p.text.trim())
    .map((p) => `SOURCE ${p.url}\n${p.text.slice(0, 1800)}`)
    .join("\n\n");
  return [list && `SEARCH HITS:\n${list}`, bodies && `PAGE TEXT:\n${bodies}`].filter(Boolean).join("\n\n");
}
