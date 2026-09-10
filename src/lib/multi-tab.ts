/**
 * Multi-tab parallel research (on-device CDP + fetch/Playwright fallback).
 * Research playbooks may open 5–10 public URLs. DOM-first. Domain allowlist.
 * Writes still go through the approval gate.
 */

import { extractUrls } from "@/lib/fetch-url";
import { MAX_PAGES_PER_JOB } from "@/lib/browse";

export const MAX_RESEARCH_TABS = 10;
export const RESEARCH_TAB_INTENT = 5;

export const MULTI_TAB_PLAYBOOKS = new Set([
  "multi_tab_research",
  "seo_brief",
  "daily_client_brief",
  "competitor_watch",
  "account_research",
]);

export function tabCapForPlaybook(playbookKey?: string | null) {
  if (playbookKey && MULTI_TAB_PLAYBOOKS.has(playbookKey)) return MAX_RESEARCH_TABS;
  return MAX_PAGES_PER_JOB;
}

export function researchUrlsFromMessage(message: string, website?: string): string[] {
  const fromMessage = extractUrls(message);
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const url of [...fromMessage, website || ""]) {
    const trimmed = url.trim();
    if (!trimmed) continue;
    const key = trimmed.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(trimmed);
    if (urls.length >= MAX_RESEARCH_TABS) break;
  }
  return urls;
}

export function parseUrlList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((row) => String(row || "").trim()).filter(Boolean).slice(0, MAX_RESEARCH_TABS);
  }
  if (typeof raw === "string") {
    return extractUrls(raw).slice(0, MAX_RESEARCH_TABS);
  }
  return [];
}
