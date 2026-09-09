import type { EventTriggerKind } from "@/lib/phase2";

export function defaultPlaybookForKind(kind: EventTriggerKind): string {
  if (kind === "email") return "inbox_replies";
  if (kind === "slack") return "outreach_draft_pack";
  return "weekly_client_brief";
}

export function noteForKind(kind: EventTriggerKind): string {
  if (kind === "email") {
    return "Polls Connected Gmail on cron/desk load. New matching mail starts a job. Never sends.";
  }
  if (kind === "slack") {
    return "Inbound Slack mention: POST /triggers/fire with the shared secret. Does not stand up Events API infra.";
  }
  if (kind === "schedule") {
    return "Creates/uses a ScheduledJob. Fires on desk load or GET /api/cron/jobs.";
  }
  return "Signed webhook trigger. POST /triggers/fire.";
}
