/**
 * Supervised product: external / write actions pause for a human.
 * Read-only browse may run; anything that types, clicks, posts, drafts
 * externally, or writes files waits unless a prior ask_user completed
 * or the job already recorded interactApproved.
 */

import type { JobStep, JobTool } from "@/lib/job-types";

export const WRITE_EXTERNAL_TOOLS: readonly JobTool[] = [
  "browser_click",
  "browser_type",
  "gmail_create_draft",
  "slack_post_message",
  "native_file_write",
] as const;

const WRITE_SET = new Set<string>(WRITE_EXTERNAL_TOOLS);

export function isWriteExternalTool(tool: string): boolean {
  return WRITE_SET.has(tool);
}

export function priorAskUserCompleted(steps: JobStep[], beforeStepId: string): boolean {
  for (const step of steps) {
    if (step.id === beforeStepId) break;
    if (step.tool === "ask_user" && step.status === "done") return true;
  }
  return false;
}

export function writeGatePrompt(tool: JobTool, label: string): string {
  switch (tool) {
    case "browser_click":
      return `Approve this click on your Chrome tab (${label})? CINEM Pro is supervised — it will not click until you say yes.`;
    case "browser_type":
      return `Approve typing on your Chrome tab (${label})? CINEM Pro will not type until you say yes.`;
    case "gmail_create_draft":
      return `Approve creating a Gmail draft (${label})? It will not send.`;
    case "slack_post_message":
      return `Approve posting to Slack (${label})? Nothing posts until you say yes.`;
    case "native_file_write":
      return `Approve writing a local file (${label})? The native agent will not write until you say yes.`;
    default:
      return `Approve this external action (${label})? CINEM Pro pauses every write.`;
  }
}
