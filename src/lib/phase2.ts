/**
 * Phase 2 interfaces — ship the shapes now so later work is not a rewrite.
 * Prefer finishing Phase 1; these are stubs or thin wrappers, not product claims.
 */

export const PHASE2_STATUS = {
  scheduledRoutines: {
    status: "partial" as const,
    note: "ScheduledJob + daily cron already queue the same playbooks. Slack/email *deliver* is stubbed — drafts still pause at ask_user.",
  },
  eventTriggers: {
    status: "stub" as const,
    note: "EventTrigger rows can be stored (kind + config JSON). No inbound webhook runner yet.",
  },
  saveAsSkill: {
    status: "shipped" as const,
    note: "POST /api/workspaces/:id/skills already saves a job’s playbook; Run skill reuses it.",
  },
  actionCache: {
    status: "interface" as const,
    note: "ActionCache stores domain + actionKey → CSS selector. Hits skip a fresh LLM guess; misses still use the playbook selector.",
  },
  sessionReplay: {
    status: "stub" as const,
    note: "JobEvent timeline is the Phase 1 narration/audit. Packed replay blobs are not recorded yet.",
  },
  promptInjectionGuards: {
    status: "shipped" as const,
    note: "Page content is wrapped in CINEM_UNTRUSTED_PAGE_CONTENT delimiters; planner/system rules treat it as data only.",
  },
  deliverSlack: {
    status: "stub" as const,
    note: "deliver_slack stays a no-op besides an honest audit line. Live Slack post still requires Connected Slack + ask_user.",
  },
  deliverEmail: {
    status: "stub" as const,
    note: "deliver_email is a stub. Gmail creates drafts only.",
  },
};

export type Phase2Key = keyof typeof PHASE2_STATUS;

export type EventTriggerKind = "email" | "slack" | "schedule" | "webhook";

export type EventTriggerConfig = {
  kind: EventTriggerKind;
  playbookKey?: string;
  enabled: boolean;
  note: string;
};

export function defaultEventTriggerStubs(): EventTriggerConfig[] {
  return [
    {
      kind: "schedule",
      playbookKey: "weekly_client_brief",
      enabled: false,
      note: "Phase 2: wire ScheduledJob cadence to this playbook. Not firing yet from this stub list.",
    },
    {
      kind: "slack",
      enabled: false,
      note: "Phase 2: Slack event trigger stub. Will not post.",
    },
    {
      kind: "email",
      enabled: false,
      note: "Phase 2: email inbound trigger stub. Will not send.",
    },
    {
      kind: "webhook",
      enabled: false,
      note: "Phase 2: signed webhook trigger stub.",
    },
  ];
}

export function phase2Catalog() {
  return {
    title: "Phase 2 scaffolding",
    supervised: true,
    items: PHASE2_STATUS,
    eventTriggers: defaultEventTriggerStubs(),
  };
}
