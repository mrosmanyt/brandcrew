/**
 * Prefer the user's Chrome (MV3 + chrome.debugger CDP via native host).
 * Fall back to Playwright/fetch when no device is online.
 */
import { recordWorkspaceAudit } from "@/lib/audit";
import { rememberCachedSelector, actionKeyFor, lookupCachedAction, recordCacheMiss } from "@/lib/action-cache";
import { guessSelectorFromDigest } from "@/lib/selector-guess";
import {
  enqueueDeviceCommand,
  waitForDeviceCommand,
} from "@/lib/device-commands";
import type { DeviceCommandResult, DeviceTool } from "@/lib/device-protocol";
import { DomainAllowlistAbort, hostFromUrl } from "@/lib/domain-allowlist";
import type { BrowsePage } from "@/lib/browse";
import type { BrowsedPage } from "@/lib/job-types";

export { DomainAllowlistAbort };

export async function tryDeviceBrowser(input: {
  workspaceId: string;
  jobId: string;
  stepId: string;
  tool: DeviceTool;
  args: Record<string, unknown>;
  allowedDomains: string[];
}): Promise<DeviceCommandResult | null> {
  const queued = await enqueueDeviceCommand(input);
  if (!queued) return null;
  const result = await waitForDeviceCommand(queued.commandId);
  if (result?.abortedDomain || (result?.error && /allowlist|outside this job/i.test(result.error))) {
    throw new DomainAllowlistAbort(
      result.error || `Aborted: left allowlist (${result.abortedDomain || "unknown host"}).`,
      result.abortedDomain || "",
    );
  }
  if (result?.ok && result.page?.url) {
    const selector = String(input.args.selector || "").trim();
    if (selector && (input.tool === "browser_click" || input.tool === "browser_type")) {
      await rememberCachedSelector({
        workspaceId: input.workspaceId,
        domain: hostFromUrl(result.page.url),
        actionKey: actionKeyFor(input.tool, input.args),
        selector,
      });
    }
  }
  return result;
}

export async function resolveClickSelector(input: {
  workspaceId: string;
  url: string;
  tool: string;
  args: Record<string, unknown>;
  digestText?: string;
  title?: string;
}): Promise<Record<string, unknown> & { cacheHit?: boolean; llmLocator?: boolean }> {
  const existing = String(input.args.selector || "").trim();
  if (existing) return input.args;
  const domain = hostFromUrl(input.url);
  const actionKey = actionKeyFor(input.tool, input.args);
  const cached = await lookupCachedAction({
    workspaceId: input.workspaceId,
    domain,
    actionKey,
  });
  if (cached?.selector) {
    return { ...input.args, selector: cached.selector, cacheHit: true };
  }
  const guessed = await guessSelectorFromDigest({
    tool: input.tool,
    goal: String(input.args.label || input.args.text || input.tool),
    url: input.url,
    title: input.title,
    text: input.digestText,
  });
  if (guessed) {
    return { ...input.args, selector: guessed, llmLocator: true };
  }
  await recordCacheMiss({ workspaceId: input.workspaceId, domain, actionKey });
  return input.args;
}

export function devicePageToBrowse(page: NonNullable<DeviceCommandResult["page"]>): BrowsePage {
  return {
    url: page.url,
    ok: page.ok,
    title: page.title,
    text: page.text,
    excerpt: page.excerpt,
    links: page.links || [],
    engine: page.engine === "cdp" || page.engine === "native" ? "playwright" : page.engine,
    error: page.error,
  };
}

export function devicePageToBrowsed(page: NonNullable<DeviceCommandResult["page"]>): BrowsedPage {
  return {
    url: page.url,
    ok: page.ok,
    title: page.title,
    text: page.text,
    excerpt: page.excerpt,
    links: page.links,
    engine: page.engine,
    error: page.error,
  };
}

export async function auditDomainAbort(input: {
  workspaceId: string;
  jobId: string;
  reason: string;
  url?: string;
}) {
  await recordWorkspaceAudit({
    workspaceId: input.workspaceId,
    jobId: input.jobId,
    actor: "system",
    action: "domain_abort",
    detail: input.reason,
    data: { url: input.url },
  });
}
