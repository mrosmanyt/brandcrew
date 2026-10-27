/**
 * Pure web autopilot intent detection (testable without Playwright imports).
 */
import { isMediaCommand, extractMediaQuery } from "../browserIntents";

export type WebAutopilotKind = "youtube-play" | "google-first";

export interface WebAutopilotCommand {
  kind: WebAutopilotKind;
  query: string;
}

const GOOGLE_FIRST_RE =
  /\b(?:google|search)\b.*\b(?:first|top)\b.*\b(?:result|link|page)\b/i;
const YT_SEARCH_PLAY_RE =
  /\byoutube\b.*\b(?:search|find)\b.*\b(?:play|first|top)\b/i;

export function isWebAutopilotCommand(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (GOOGLE_FIRST_RE.test(t)) return true;
  if (YT_SEARCH_PLAY_RE.test(t)) return true;
  if (/\bopen\b.*\byoutube\b.*\bsearch\b.*\bplay\b/i.test(t)) return true;
  return false;
}

function extractQuery(text: string): string {
  return text
    .replace(/\b(on|in|from)\s+(google|youtube|the web)\b/gi, " ")
    .replace(/\b(please|can you|could you|for me|and)\b/gi, " ")
    .replace(/\b(open|launch|go to|search|find|google|youtube)\b/gi, " ")
    .replace(/\b(first|top|result|link|page|play|click)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseWebAutopilot(text: string): WebAutopilotCommand | null {
  const t = text.trim();
  if (!t) return null;
  if (GOOGLE_FIRST_RE.test(t) || (/\bgoogle\b/i.test(t) && /\bfirst\b/i.test(t))) {
    const q = extractQuery(t);
    return q ? { kind: "google-first", query: q } : null;
  }
  if (YT_SEARCH_PLAY_RE.test(t) || (/\byoutube\b/i.test(t) && /\bsearch\b/i.test(t))) {
    const q = extractQuery(t) || extractMediaQuery(t);
    return q ? { kind: "youtube-play", query: q } : null;
  }
  if (isMediaCommand(t)) {
    const q = extractMediaQuery(t);
    if (q) return { kind: "youtube-play", query: q };
  }
  return null;
}
