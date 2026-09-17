/**
 * Pure command routing for browser / YouTube / Google research.
 * Kept free of stores so unit tests can lock the play vs research vs open split.
 */

export type BrowserIntent =
  | { kind: "play"; query: string }
  | { kind: "research"; query: string }
  | { kind: "open"; siteQuery: string }
  | { kind: "other" };

const PLAY_RE = /\bplay\b|\bwatch\b|\bstream\b|\bput on\b/;
const YOUTUBE_RE = /\byoutube\b|\byt\b|\bcinem-ai-assistant player\b/;
const RESEARCH_PREFIX =
  /^(?:research|google|search|look up|lookup|find)\s+(?:on\s+|about\s+|for\s+)?(.+)$/i;
const RESEARCH_UR =
  /^(.+?)\s+(?:par|pe|ki|ka)?\s*research\s*(?:karo|karein|kar)\s*$/i;

/** "open youtube and play X" is media, not a homepage-only open. */
export function isMediaCommand(text: string): boolean {
  const t = text.toLowerCase();
  if (/\bcinem-ai-assistant player\b/.test(t)) return true;
  if (/\bplay\b/.test(t)) return true;
  if (YOUTUBE_RE.test(t) && /\b(search|watch|stream|find)\b/.test(t)) return true;
  return false;
}

export function extractMediaQuery(text: string): string {
  return text
    .replace(/\b(open|launch|start)\s+(youtube|cinem-ai-assistant player)\s*(and|then)?\s*/gi, "")
    .replace(/\b(on|in|from)\s+(youtube|the\s+)?(cinem-ai-assistant\s+)?player\b/gi, "")
    .replace(/\bon\s+youtube\b/gi, "")
    .replace(/\byoutube\b/gi, "")
    .replace(/\b(please|can you|could you|for me)\b/gi, "")
    .replace(/\b(play|watch|put on|stream)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isResearchCommand(text: string): boolean {
  const t = text.trim();
  if (isMediaCommand(t) && YOUTUBE_RE.test(t.toLowerCase())) return false;
  if (RESEARCH_PREFIX.test(t) || RESEARCH_UR.test(t)) return true;
  if (/\bon google\b/i.test(t) && /\b(research|search|look up|find)\b/i.test(t)) return true;
  return false;
}

export function extractResearchQuery(text: string): string {
  const t = text.trim();
  const prefix = t.match(RESEARCH_PREFIX);
  const ur = t.match(RESEARCH_UR);
  let q = (prefix?.[1] || ur?.[1] || t).trim();
  q = q
    .replace(/\b(please|for me|karo|kar)\b/gi, " ")
    .replace(/\bon (?:the )?(?:web|google|internet)\b/gi, " ")
    .replace(/\busing google\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return q || t;
}

/** Bare "open google" / "open youtube" — no query to play or research. */
export function isBareOpenCommand(text: string): boolean {
  const t = text.toLowerCase().trim();
  return /^(?:open|launch|go to|goto|visit|start|show me)\s+/.test(t) && !PLAY_RE.test(t);
}

export function classifyBrowserIntent(text: string): BrowserIntent {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "other" };
  if (isMediaCommand(trimmed)) {
    return { kind: "play", query: extractMediaQuery(trimmed) || trimmed };
  }
  if (isResearchCommand(trimmed)) {
    return { kind: "research", query: extractResearchQuery(trimmed) };
  }
  if (isBareOpenCommand(trimmed)) {
    return { kind: "open", siteQuery: trimmed };
  }
  return { kind: "other" };
}

export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export function youtubeWatchUrl(videoId: string, autoplay = true): string {
  const id = videoId.replace(/[^\w-]/g, "");
  return `https://www.youtube.com/watch?v=${id}${autoplay ? "&autoplay=1" : ""}`;
}

/** Embed that autoplays the best match for a search (no Data API key). */
export function youtubeEmbedSearchUrl(query: string): string {
  return (
    "https://www.youtube.com/embed?listType=search&list=" +
    `${encodeURIComponent(query)}&autoplay=1&enablejsapi=1&rel=0`
  );
}

export function youtubeEmbedWatchUrl(videoId: string): string {
  const id = videoId.replace(/[^\w-]/g, "");
  return `https://www.youtube.com/embed/${id}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1`;
}

export function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}&igu=1`;
}

export function duckDuckGoSearchUrl(query: string): string {
  return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
}

const YT_ID = /(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([\w-]{11})/;

export function youtubeVideoIdFromUrl(url: string): string | null {
  const match = url.match(YT_ID);
  return match?.[1] || null;
}

export type YouTubeControlAction = "play" | "pause" | "next" | "skip";

/** Voice commands for in-app player or Playwright YouTube tab. */
export function parseYouTubeControl(text: string): YouTubeControlAction | null {
  const t = text.toLowerCase().trim();
  if (!/\b(youtube|video|player|music)\b/.test(t) && !/^(pause|play|resume|next|skip)\b/.test(t)) {
    return null;
  }
  if (/\b(next|skip)\b/.test(t)) return "next";
  if (/\b(pause|stop)\b/.test(t)) return "pause";
  if (/\b(play|resume|unpause|continue)\b/.test(t)) return "play";
  return null;
}

export function parseYouTubeIdsFromHtml(html: string, max = 6): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const re = /(?:watch\?v=|youtu\.be\/|\/embed\/|\/shorts\/)([\w-]{11})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && ids.length < max) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}
