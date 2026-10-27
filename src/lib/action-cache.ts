import { prisma } from "@/lib/db";
import { hostFromUrl } from "@/lib/domain-allowlist";
import type { JobStep } from "@/lib/job-types";
import {
  actionKeyFor,
  applyCacheToSteps,
  parseRecipe,
  type ActionCacheHit,
  type CachedRecipe,
} from "@/lib/action-cache-pure";

export {
  DETERMINISTIC_TOOLS,
  actionKeyFor,
  applyCacheToSteps,
  mergeCachedArgs,
  parseRecipe,
  scoreCachedReplay,
  stepNeedsLlm,
  type ActionCacheHit,
  type CachedRecipe,
  type StepLlmDecision,
} from "@/lib/action-cache-pure";

function normalizeDomain(raw: string): string {
  return raw.replace(/^www\./, "").toLowerCase();
}

export async function lookupCachedSelector(input: {
  workspaceId: string;
  domain: string;
  actionKey: string;
}): Promise<string | null> {
  const hit = await lookupCachedAction(input);
  return hit?.selector || null;
}

export async function lookupCachedAction(input: {
  workspaceId: string;
  domain: string;
  actionKey: string;
}): Promise<ActionCacheHit | null> {
  const domain = normalizeDomain(input.domain);
  if (!domain || !input.actionKey.trim()) return null;
  const row = await prisma.actionCache.findUnique({
    where: {
      workspaceId_domain_actionKey: {
        workspaceId: input.workspaceId,
        domain,
        actionKey: input.actionKey,
      },
    },
  });
  if (!row?.selector) return null;
  await prisma.actionCache.update({
    where: { id: row.id },
    data: { hits: { increment: 1 } },
  });
  return {
    selector: row.selector,
    recipe: parseRecipe(row.recipe),
    domain: row.domain,
    actionKey: row.actionKey,
  };
}

export async function rememberCachedSelector(input: {
  workspaceId: string;
  domain: string;
  actionKey: string;
  selector: string;
  recipe?: CachedRecipe;
  playbookKey?: string;
}) {
  const domain = normalizeDomain(input.domain);
  const selector = input.selector.trim();
  if (!domain || !selector || !input.actionKey.trim()) return;
  await prisma.actionCache.upsert({
    where: {
      workspaceId_domain_actionKey: {
        workspaceId: input.workspaceId,
        domain,
        actionKey: input.actionKey.trim(),
      },
    },
    create: {
      workspaceId: input.workspaceId,
      domain,
      actionKey: input.actionKey.trim(),
      selector,
      recipe: JSON.stringify(input.recipe ?? { selector }),
      playbookKey: input.playbookKey || "",
      hits: 1,
    },
    update: {
      selector,
      recipe: JSON.stringify(input.recipe ?? { selector }),
      playbookKey: input.playbookKey || undefined,
      hits: { increment: 1 },
    },
  });
}

export async function recordCacheMiss(input: {
  workspaceId: string;
  domain: string;
  actionKey: string;
}) {
  const domain = normalizeDomain(input.domain);
  if (!domain || !input.actionKey.trim()) return;
  const existing = await prisma.actionCache.findUnique({
    where: {
      workspaceId_domain_actionKey: {
        workspaceId: input.workspaceId,
        domain,
        actionKey: input.actionKey.trim(),
      },
    },
  });
  if (!existing) return;
  await prisma.actionCache.update({
    where: { id: existing.id },
    data: { misses: { increment: 1 } },
  });
}

export async function applyWorkspaceCacheToSteps(input: {
  workspaceId: string;
  url?: string;
  steps: JobStep[];
}): Promise<{ steps: JobStep[]; cacheHits: number; llmSkipped: number; llmCalls: number }> {
  const domain = input.url ? hostFromUrl(input.url) : "";
  if (!domain) {
    return applyCacheToSteps(input.steps, () => null);
  }
  const keys = input.steps.map((step) => actionKeyFor(step.tool, step.args));
  const rows = await prisma.actionCache.findMany({
    where: { workspaceId: input.workspaceId, domain, actionKey: { in: keys } },
  });
  const byKey = new Map(rows.map((row) => [row.actionKey, row]));
  return applyCacheToSteps(input.steps, (step) => {
    const row = byKey.get(actionKeyFor(step.tool, step.args));
    if (!row?.selector) return null;
    return {
      selector: row.selector,
      recipe: parseRecipe(row.recipe),
      domain: row.domain,
      actionKey: row.actionKey,
    };
  });
}

export async function rememberSuccessfulInteract(input: {
  workspaceId: string;
  url: string;
  tool: string;
  args: Record<string, unknown>;
  playbookKey?: string;
}) {
  const selector = String(input.args.selector || "").trim();
  if (!selector) return;
  await rememberCachedSelector({
    workspaceId: input.workspaceId,
    domain: hostFromUrl(input.url),
    actionKey: actionKeyFor(input.tool, input.args),
    selector,
    recipe: { ...input.args, selector },
    playbookKey: input.playbookKey,
  });
}
