/**
 * Prefer the user's Chrome (MV3 + chrome.debugger CDP via native host).
 * Fall back to Playwright/fetch when no device is online.
 */
import { recordWorkspaceAudit } from "@/lib/audit";
import { rememberCachedSelector, actionKeyFor, lookupCachedSelector } from "@/lib/action-cache";
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
}): Promise<Record<string, unknown>> {
  const selector = String(input.args.selector || "").trim();
  if (selector) return input.args;
  const cached = await lookupCachedSelector({
    workspaceId: input.workspaceId,
    domain: hostFromUrl(input.url),
    actionKey: actionKeyFor(input.tool, input.args),
  });
  if (!cached) return input.args;
  return { ...input.args, selector: cached };
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
