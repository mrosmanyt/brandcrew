/**
 * Supervised product: high-risk external writes always pause for a human.
 * Read-only browse, research, Gmail list, in-desk drafts/artifacts, narration,
 * and Gmail *drafts* run without a prompt. Gmail *send*, Slack post, spend,
 * delete, and irreversible file writes always wait.
 *
 * Safe page interactions (click / type) pause unless the workspace has
 * **Always approved** on. That preference never skips high-risk tools.
 */

import { parseAskKind } from "@/lib/job-clarify";
import type { JobStep, JobTool } from "@/lib/job-types";
import { composioToolLooksLikeWrite } from "@/lib/composio";
import { isClientNamedEmail } from "@/lib/client-workspaces";

export type ApprovalClass = "always" | "safe" | "none";

/** High-risk: always gated, even when Always approved is on. */
export const ALWAYS_GATED_TOOLS: readonly string[] = [
  "slack_post_message",
  "gmail_send",
  "native_file_write",
  "composio_write",
] as const;

/**
 * Safe-but-interactive: gated unless Always approved is on.
 * Not read-only browse (navigate/snapshot/extract) and not in-desk drafts.
 */
export const SAFE_WRITE_TOOLS: readonly string[] = ["browser_click", "browser_type"] as const;

/** @deprecated Use ALWAYS_GATED_TOOLS + SAFE_WRITE_TOOLS. Kept as their union. */
export const WRITE_EXTERNAL_TOOLS: readonly JobTool[] = [
  "browser_click",
  "browser_type",
  "slack_post_message",
  "native_file_write",
] as const;

const ALWAYS_SET = new Set<string>(ALWAYS_GATED_TOOLS);
const SAFE_SET = new Set<string>(SAFE_WRITE_TOOLS);
const WRITE_SET = new Set<string>([...ALWAYS_GATED_TOOLS, ...SAFE_WRITE_TOOLS]);

export function parseAutoApproveSafe(value: unknown): boolean {
  return value === true;
}

export type ApprovalExtras = {
  clientNamedEmail?: boolean;
  composioTool?: string;
};

function extrasFromStep(step: { tool?: string; args?: Record<string, unknown> }): ApprovalExtras {
  const args = step.args || {};
  return {
    clientNamedEmail:
      Boolean(args.clientNamed) ||
      isClientNamedEmail({
        flagged: Boolean(args.clientNamed),
        workspaceKind: String(args.workspaceKind || ""),
        clientName: String(args.clientName || ""),
        to: String(args.to || ""),
        subject: String(args.subject || ""),
        body: String(args.body || args.text || ""),
      }),
    composioTool: String(args.tool || args.slug || ""),
  };
}

export function approvalClass(tool: string, extras?: ApprovalExtras): ApprovalClass {
  if (tool === "gmail_create_draft" && extras?.clientNamedEmail) return "always";
  if (tool === "composio_execute" && extras?.composioTool && composioToolLooksLikeWrite(extras.composioTool)) {
    return "always";
  }
  if (ALWAYS_SET.has(tool)) return "always";
  if (SAFE_SET.has(tool)) return "safe";
  return "none";
}

export function isWriteExternalTool(tool: string): boolean {
  return WRITE_SET.has(tool) || tool === "composio_execute";
}

export function isAlwaysGatedTool(tool: string): boolean {
  return ALWAYS_SET.has(tool);
}

export function planHasAlwaysGatedTool(steps: { tool: string; args?: Record<string, unknown> }[]): boolean {
  return steps.some((step) => approvalClass(step.tool, extrasFromStep(step)) === "always");
}

export function planHasSafeWriteTool(steps: { tool: string; args?: Record<string, unknown> }[]): boolean {
  return steps.some((step) => approvalClass(step.tool, extrasFromStep(step)) === "safe");
}

/**
 * Whether this tool must pause before running.
 * Always-gated tools ignore autoApproveSafe.
 */
export function toolNeedsApproval(
  tool: string,
  autoApproveSafe: boolean,
  extras?: ApprovalExtras,
): boolean {
  const cls = approvalClass(tool, extras);
  if (cls === "always") return true;
  if (cls === "safe") return !autoApproveSafe;
  return false;
}

/**
 * Trailing / mid-plan ask_user (kind=approve) pauses only when the plan
 * still has a high-risk write, or a safe write while Always approved is off.
 * Clarify questions always wait. In-desk drafts and Gmail list do not.
 */
export function shouldPauseAskUser(
  step: { tool: string; args?: Record<string, unknown> },
  plan: { tool: string }[],
  autoApproveSafe: boolean,
): boolean {
  if (step.tool !== "ask_user") return false;
  if (parseAskKind(step.args) === "clarify") return true;
  if (planHasAlwaysGatedTool(plan)) return true;
  if (!autoApproveSafe && planHasSafeWriteTool(plan)) return true;
  return false;
}

export function priorAskUserCompleted(steps: JobStep[], beforeStepId: string): boolean {
  for (const step of steps) {
    if (step.id === beforeStepId) break;
    if (step.tool === "ask_user" && step.status === "done") return true;
  }
  return false;
}

export function writeGatePrompt(tool: JobTool | string, label: string): string {
  switch (tool) {
    case "browser_click":
      return `Approve this click on your Chrome tab (${label})? CINEM Pro is supervised — it will not click until you say yes. Turn on Always approved to auto-run safe clicks.`;
    case "browser_type":
      return `Approve typing on your Chrome tab (${label})? CINEM Pro will not type until you say yes. Turn on Always approved to auto-run safe typing.`;
    case "gmail_send":
      return `Approve sending this email (${label})? CINEM Pro will not send until you say yes. Always approved does not skip sends.`;
    case "gmail_create_draft":
      return `Approve this client-named email draft (${label})? CINEM Pro will not create the Gmail draft until you say yes. It still will not send. Generic Gmail drafts (not client-named) do not pause.`;
    case "composio_execute":
      return `Approve this Composio write (${label})? CINEM Pro will not call a write tool until you say yes. Always approved does not skip writes.`;
    case "slack_post_message":
      return `Approve posting to Slack (${label})? Nothing posts until you say yes. Always approved does not skip Slack posts.`;
    case "native_file_write":
      return `Approve writing a local file (${label})? The native agent will not write until you say yes. Always approved does not skip file writes.`;
    default:
      return `Approve this high-risk action (${label})? CINEM Pro pauses sends, posts, payments, and irreversible writes.`;
  }
}

export const ALWAYS_APPROVED_LABEL = "Always approved";

export const ALWAYS_APPROVED_HINT =
  "Auto-run safe browse clicks and typing. Sends, Slack posts, payments, and file writes still wait for you.";

export const APPROVAL_QUEUE_EMPTY =
  "Nothing waiting. High-risk writes (send email, Slack post, payments, file writes) always pause here. Gmail drafts, list mail, research, and in-desk artifacts do not.";
