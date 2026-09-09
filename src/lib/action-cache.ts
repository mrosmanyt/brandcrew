import { prisma } from "@/lib/db";

/**
 * Cached CSS selectors so a later job on the same domain can skip an LLM guess.
 * Phase 1 stores hits from successful CDP click/type; lookup is best-effort.
 */
export async function lookupCachedSelector(input: {
  workspaceId: string;
  domain: string;
  actionKey: string;
}): Promise<string | null> {
  const domain = input.domain.replace(/^www\./, "").toLowerCase();
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
  return row.selector;
}

export async function rememberCachedSelector(input: {
  workspaceId: string;
  domain: string;
  actionKey: string;
  selector: string;
}) {
  const domain = input.domain.replace(/^www\./, "").toLowerCase();
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
      hits: 1,
    },
    update: { selector, hits: { increment: 1 } },
  });
}

export function actionKeyFor(tool: string, args: Record<string, unknown>): string {
  const label = String(args.label || args.text || args.selector || tool).trim().slice(0, 120);
  return `${tool}:${label.toLowerCase()}`;
}
