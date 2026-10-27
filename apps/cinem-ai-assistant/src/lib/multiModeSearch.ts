/**
 * Multi-mode web search — news / research / price / compare / general search.
 * Always returns a chat-ready markdown brief.
 */
import { chatLLM } from "@/lib/llm";
import { fetchHeadlines } from "@/lib/news";
import {
  fetchPageText,
  formatHitsForPrompt,
  searchPublicWeb,
  type WebHit,
} from "@/lib/publicWebSearch";
import { researchInBrowser } from "@/lib/playwrightActions";
import { languageDirective } from "@/lib/language";
import { isResearchCommand } from "@/lib/browserIntents";
import { useAppStore } from "@/store/useAppStore";
import type { Settings } from "@/store/useSettingsStore";

export type SearchMode = "news" | "research" | "price" | "compare" | "search";

export type ParsedSearch = { mode: SearchMode; query: string };

const MODE_PATTERNS: { mode: SearchMode; re: RegExp }[] = [
  { mode: "news", re: /\b(news|headlines|breaking)\b/i },
  { mode: "price", re: /\b(price|cost|how much|pricing|cheapest)\b/i },
  { mode: "compare", re: /\b(compare|comparison|vs\.?|versus|difference between)\b/i },
  { mode: "research", re: /\b(research|deep dive|analyze|investigate)\b/i },
];

/** Detect search mode + extract query from natural language. */
export function parseMultiModeSearch(text: string): ParsedSearch | null {
  const t = text.trim();
  if (!t || isResearchCommand(t)) return null;

  let mode: SearchMode = "search";
  for (const { mode: m, re } of MODE_PATTERNS) {
    if (re.test(t)) {
      mode = m;
      break;
    }
  }

  if (!/\b(search|find|look up|lookup|news|price|compare|research|google)\b/i.test(t)) {
    return null;
  }

  let query = t
    .replace(/^(?:please|can you|could you)\s+/i, "")
    .replace(
      /^(?:search|find|look up|lookup|google)\s+(?:for\s+|about\s+|on\s+)?/i,
      "",
    )
    .replace(/\b(news|headlines|breaking news)\s+(?:about|on|for)\s+/i, "")
    .replace(/\b(price of|cost of|how much is|how much does)\s+/i, "")
    .replace(/\b(compare|comparison of)\s+/i, "")
    .replace(/\b(research|deep dive on|investigate)\s+/i, "")
    .replace(/\bon (?:the )?(?:web|google|internet)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!query) query = t;
  return { mode, query };
}

function modePrompt(mode: SearchMode, query: string): string {
  const base = `Query: """${query}"""`;
  switch (mode) {
    case "news":
      return `${base}\nFocus: latest headlines and what changed recently. Cite sources.`;
    case "price":
      return `${base}\nFocus: current price ranges, where to buy, and caveats (region/date). Be honest if prices vary.`;
    case "compare":
      return `${base}\nFocus: concise comparison table or bullets — pros/cons for each option.`;
    case "research":
      return `${base}\nFocus: structured research brief with key findings, details, bottom line.`;
    default:
      return `${base}\nFocus: direct answer with 3-5 bullet takeaways.`;
  }
}

async function gatherEvidence(query: string, mode: SearchMode): Promise<string> {
  const blocks: string[] = [];

  if (mode === "news") {
    try {
      const heads = await fetchHeadlines(8);
      const filtered = heads.filter(
        (h) =>
          !query ||
          h.title.toLowerCase().includes(query.toLowerCase().split(/\s+/)[0] || "") ||
          query.length < 4,
      );
      const list = (filtered.length ? filtered : heads).slice(0, 6);
      if (list.length) {
        blocks.push(
          "HEADLINES:\n" + list.map((h) => `- ${h.title} (${h.source}) ${h.url}`).join("\n"),
        );
      }
    } catch {
      /* optional */
    }
  }

  const hits = await searchPublicWeb(
    mode === "price" ? `${query} price` : mode === "compare" ? `${query} comparison` : query,
    6,
  );
  if (hits.length) blocks.push(formatHitsForPrompt(hits));

  const pages: { url: string; text: string }[] = [];
  for (const hit of hits.slice(0, 3)) {
    const page = await fetchPageText(hit.url);
    if (page.ok) pages.push({ url: page.url, text: page.text });
  }
  if (pages.length) {
    blocks.push(
      "PAGE EXCERPTS:\n" +
        pages.map((p) => `${p.url}\n${p.text.slice(0, 1400)}`).join("\n\n"),
    );
  }

  const live = await researchInBrowser(query);
  if (live.ok && (live.pages.length || live.results.length)) {
    blocks.push(
      "LIVE BROWSER:\n" +
        [...live.results, ...live.pages.map((p) => ({ title: p.title || p.url, url: p.url, snippet: p.text?.slice(0, 400) }))]
          .slice(0, 6)
          .map((r) => `- ${"title" in r ? r.title : r.url}: ${"url" in r ? r.url : ""}`)
          .join("\n"),
    );
  }

  return blocks.join("\n\n") || "No public sources captured.";
}

function offlineBrief(mode: SearchMode, query: string, evidence: string): string {
  return [
    `# ${mode.charAt(0).toUpperCase() + mode.slice(1)}: ${query}`,
    "",
    "## Summary",
    evidence.slice(0, 1200) || "Limited public data — try the Playwright sidecar for live tabs.",
    "",
    "## Note",
    "Verify critical facts before acting. Sources are public web only.",
  ].join("\n");
}

/** Run multi-mode search and return markdown for chat. */
export async function runMultiModeSearch(
  parsed: ParsedSearch,
  settings: Settings,
): Promise<string> {
  const { mode, query } = parsed;
  const evidence = await gatherEvidence(query, mode);
  const lang = languageDirective(useAppStore.getState().language);

  try {
    return (
      await chatLLM(
        `${modePrompt(mode, query)}

SOURCES:
${evidence}

Write a tight markdown brief:
- "## Summary" — 2-4 sentences
- "## Key Points" — bullets with specifics
- "## Sources" — URLs you used (if any)
Keep it under 220 words unless compare mode needs a small table.${lang}`,
        settings,
        {
          system:
            "You are Cinem AI Assistant — confident, precise, honest about gaps. Never invent prices or quotes.",
          temperature: 0.35,
          maxTokens: 1200,
        },
      )
    ).trim();
  } catch {
    return offlineBrief(mode, query, evidence);
  }
}

export function isMultiModeSearchCommand(text: string): boolean {
  return parseMultiModeSearch(text) !== null;
}
