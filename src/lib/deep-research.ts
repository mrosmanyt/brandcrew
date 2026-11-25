/**
 * Deep research mode for the chat product (Package 7).
 *
 * Flow: the model plans sub-questions for the user's research question,
 * each sub-question runs one real web search (same Tavily stack as chat
 * web search, metered one search charge per call), and the model then
 * writes a long, structured report grounded only in those results, with
 * numbered inline citations matching the persisted source list.
 *
 * This module is pure (no db, no env): parsing, caps, context assembly
 * and the export format live here; the chat stream route orchestrates
 * the model/search calls.
 */
import type { ChatSearchSource } from "@/lib/chat-search";

/** Hard cap on Tavily calls per research run — cost control. */
export const MAX_RESEARCH_SEARCHES = 6;

/** Hard cap on sources kept (deduped) for one report. */
export const MAX_RESEARCH_SOURCES = 24;

export type ResearchSource = ChatSearchSource & { excerpt: string };

export const RESEARCH_PLAN_SYSTEM_PROMPT =
  "You are planning a web research task. Break the user's research question into focused sub-questions that together cover it well: definitions and current facts, key players or options, evidence and data, trade-offs or criticisms, and recent developments where relevant. Output ONLY the sub-questions, one per line, no numbering, no bullets, no commentary. Each sub-question must work as a standalone web search query.";

export const RESEARCH_PLAN_INSTRUCTION = `Write between 4 and ${MAX_RESEARCH_SEARCHES} sub-questions.`;

export const RESEARCH_REPORT_SYSTEM_PROMPT = `You are writing a deep research report. You are given numbered web search results gathered just now for the user's research question.

Rules:
- Write a long, well-structured markdown report: a short executive summary, then sections with ## headings covering the sub-topics, and a brief conclusion. Use lists and tables where they help.
- Ground every factual claim in the search results and cite inline like [1], [2] matching the numbered source list. Never invent facts, numbers, quotes, or sources that are not in the results.
- Where the results disagree or are thin, say so plainly instead of guessing.
- Do NOT add a source list at the end — the app shows the sources separately.
- Answer in the user's language.`;

/**
 * Parse the planner model's output into clean sub-questions. Falls back
 * to the raw question when the output has nothing usable, so a research
 * run still searches for exactly what the user asked.
 */
export function parseSubQuestions(plannerText: string, question: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rawLine of plannerText.split(/\r?\n/)) {
    const line = rawLine
      .replace(/^[\s\-*•]+/, "")
      .replace(/^\d+[.)]\s*/, "")
      .trim();
    if (line.length < 8 || line.length > 300) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= MAX_RESEARCH_SEARCHES) break;
  }
  return out.length ? out : [question.trim().slice(0, 400)];
}

/** Merge per-search sources into one deduped (by URL) list, capped. */
export function mergeResearchSources(
  batches: Array<{ sources: ChatSearchSource[]; excerpts: string[] }>,
): ResearchSource[] {
  const seen = new Set<string>();
  const out: ResearchSource[] = [];
  for (const batch of batches) {
    batch.sources.forEach((source, index) => {
      const url = source.url.trim();
      if (!url || seen.has(url)) return;
      seen.add(url);
      out.push({
        title: source.title,
        url,
        excerpt: (batch.excerpts[index] ?? "").trim(),
      });
    });
    if (out.length >= MAX_RESEARCH_SOURCES) break;
  }
  return out.slice(0, MAX_RESEARCH_SOURCES);
}

/** Globally-numbered context block for the synthesis call. */
export function buildResearchContext(
  question: string,
  subQuestions: string[],
  sources: ResearchSource[],
): string {
  const lines: string[] = [
    `Research question: ${question.trim()}`,
    "",
    `Sub-questions investigated: ${subQuestions.join(" · ")}`,
    "",
    "Web search results (numbered — cite these numbers inline in the report):",
  ];
  sources.forEach((source, index) => {
    lines.push(
      `[${index + 1}] ${source.title}\n${source.url}${source.excerpt ? `\n${source.excerpt.slice(0, 1500)}` : ""}`,
    );
  });
  return lines.join("\n\n").slice(0, 30_000);
}

/** Standalone markdown export of a finished report (content + sources). */
export function researchReportMarkdown(input: {
  question?: string | null;
  content: string;
  sources: ChatSearchSource[];
}): string {
  const parts: string[] = [];
  if (input.question?.trim()) parts.push(`# ${input.question.trim()}`, "");
  parts.push(input.content.trim());
  if (input.sources.length) {
    parts.push("", "## Sources", "");
    input.sources.forEach((source, index) => {
      parts.push(`${index + 1}. [${source.title}](${source.url})`);
    });
  }
  parts.push("", "---", "Generated with CINEM Pro Deep Research");
  return parts.join("\n");
}
