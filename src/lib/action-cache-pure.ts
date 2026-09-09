import type { JobStep, JobTool } from "@/lib/job-types";

/**
 * Stagehand-style action cache (pure): on first success remember the CSS
 * selector; on repeat skip the LLM locator. Prisma I/O lives in action-cache.ts.
 */

export type CachedRecipe = {
  selector?: string;
  url?: string;
  text?: string;
  label?: string;
  [key: string]: unknown;
};

export type ActionCacheHit = {
  selector: string;
  recipe: CachedRecipe;
  domain: string;
  actionKey: string;
};

export type StepLlmDecision = {
  tool: JobTool | string;
  llm: boolean;
  reason: "deterministic" | "cached_selector" | "write" | "plan" | "locator";
};

export const DETERMINISTIC_TOOLS: readonly string[] = [
  "read_brand_kit",
  "fetch_url",
  "browser_navigate",
  "browser_snapshot",
  "browser_extract",
  "browser_screenshot",
  "crawl_links",
  "read_artifact",
  "gmail_list_recent",
  "slack_list_channels",
  "slack_draft_message",
  "slack_post_message",
  "gmail_create_draft",
  "native_file_read",
  "native_file_write",
  "ask_user",
];

export function actionKeyFor(tool: string, args: Record<string, unknown>): string {
  const label = String(args.label || args.text || args.selector || tool).trim().slice(0, 120);
  return `${tool}:${label.toLowerCase()}`;
}

export function stepNeedsLlm(tool: string, args: Record<string, unknown>, cacheHit: boolean): StepLlmDecision {
  if (tool === "write_artifact") {
    return { tool, llm: true, reason: "write" };
  }
  if (tool === "web_search") {
    return { tool, llm: false, reason: "deterministic" };
  }
  if (tool === "browser_click" || tool === "browser_type") {
    const hasSelector = Boolean(String(args.selector || "").trim()) || cacheHit;
    if (hasSelector) {
      return { tool, llm: false, reason: cacheHit ? "cached_selector" : "deterministic" };
    }
    return { tool, llm: true, reason: "locator" };
  }
  if (DETERMINISTIC_TOOLS.includes(tool)) {
    return { tool, llm: false, reason: "deterministic" };
  }
  return { tool, llm: true, reason: "plan" };
}

export function scoreCachedReplay(
  steps: Array<{ tool: string; args?: Record<string, unknown> }>,
  cacheHits: Record<string, boolean> | Set<string> | string[],
): { llmCalls: number; llmSkipped: number; skippedRatio: number; decisions: StepLlmDecision[] } {
  const hits = normalizeHits(cacheHits);
  const decisions = steps.map((step, index) => {
    const key = `${step.tool}:${index}`;
    const hit = hits.has(key) || hits.has(actionKeyFor(step.tool, step.args || {}));
    return stepNeedsLlm(step.tool, step.args || {}, hit);
  });
  const llmCalls = decisions.filter((row) => row.llm).length;
  const llmSkipped = decisions.length - llmCalls;
  return {
    llmCalls,
    llmSkipped,
    skippedRatio: decisions.length ? llmSkipped / decisions.length : 0,
    decisions,
  };
}

function normalizeHits(cacheHits: Record<string, boolean> | Set<string> | string[]): Set<string> {
  if (cacheHits instanceof Set) return cacheHits;
  if (Array.isArray(cacheHits)) return new Set(cacheHits);
  return new Set(Object.entries(cacheHits).filter(([, hit]) => hit).map(([key]) => key));
}

export function parseRecipe(raw: string | null | undefined): CachedRecipe {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as CachedRecipe;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function mergeCachedArgs(
  args: Record<string, unknown>,
  hit: ActionCacheHit | null,
): Record<string, unknown> {
  if (!hit) return args;
  const selector = String(args.selector || hit.selector || hit.recipe.selector || "").trim();
  return {
    ...hit.recipe,
    ...args,
    ...(selector ? { selector } : {}),
    cacheHit: true,
  };
}

export function applyCacheToSteps(
  steps: JobStep[],
  lookup: (step: JobStep) => ActionCacheHit | null,
): { steps: JobStep[]; cacheHits: number; llmSkipped: number; llmCalls: number } {
  let cacheHits = 0;
  const next = steps.map((step) => {
    const hit = lookup(step);
    if (!hit) return step;
    cacheHits += 1;
    return { ...step, args: mergeCachedArgs(step.args, hit) };
  });
  const scored = scoreCachedReplay(
    next,
    next.flatMap((step, index) => (step.args.cacheHit ? [`${step.tool}:${index}`, actionKeyFor(step.tool, step.args)] : [])),
  );
  return { steps: next, cacheHits, llmSkipped: scored.llmSkipped, llmCalls: scored.llmCalls };
}
