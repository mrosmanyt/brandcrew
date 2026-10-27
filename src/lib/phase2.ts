/**
 * Cost-control catalog. These are live behaviors, not scaffolding.
 * See README → Cost controls and AGENTS.md.
 */

export const PHASE2_STATUS = {
  scheduledRoutines: {
    status: "shipped" as const,
    note: "Routines re-run a saved skill on a cadence. Action cache skips LLM locators on repeat. Slack/email deliver after approval (Gmail draft never sends; Slack posts only with a channel + completed ask_user).",
  },
  eventTriggers: {
    status: "shipped" as const,
    note: "Schedule trigger uses existing cron/desk load. Email-received polls Connected Gmail. Slack mention is an inbound POST (no Events API fleet).",
  },
  saveAsSkill: {
    status: "shipped" as const,
    note: "POST /skills saves the playbook. POST /routines (or skills with cadence) also creates a scheduled routine template.",
  },
  actionCache: {
    status: "shipped" as const,
    note: "Successful click/type selectors are cached per workspace+domain. Repeat runs skip the LLM locator (Stagehand-style). Writes still call a cheap model.",
  },
  sessionReplay: {
    status: "shipped" as const,
    note: "Each finished job packs a replay (plan, events, sources, cost). Cheaper than live view as the headline.",
  },
  promptInjectionGuards: {
    status: "shipped" as const,
    note: "Page content is wrapped in CINEM_UNTRUSTED_PAGE_CONTENT; planner treats it as data. Approval gate + domain allowlist stay on.",
  },
  deliverSlack: {
    status: "shipped" as const,
    note: "Routine deliverSlack drafts on the desk; posts to a configured channel only after that run’s ask_user completed.",
  },
  deliverEmail: {
    status: "shipped" as const,
    note: "Routine deliverEmail creates a Gmail draft when Connected. Never sends.",
  },
  modelCostRouting: {
    status: "shipped" as const,
    note: "Classify/locator steps use the cheapest live engine. Heavier writes stay on Flash/Haiku/Sonnet per existing routing. Free plan is capped — no unlimited.",
  },
  promptCaching: {
    status: "shipped" as const,
    note: "Anthropic system prompts use cache_control=ephemeral. OpenAI/Gemini rely on stable prefixes (automatic/implicit cache).",
  },
  domFirst: {
    status: "shipped" as const,
    note: "Browse perceives DOM digest (text/ARIA). Vision/screenshots are fallback only when the digest is empty and explicitly allowed.",
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
      enabled: true,
      note: "Schedule cron + desk load. Wire via POST /triggers kind=schedule with an agentId.",
    },
    {
      kind: "slack",
      enabled: false,
      note: "Inbound Slack mention: POST /triggers/fire. Will not post until approved.",
    },
    {
      kind: "email",
      enabled: false,
      note: "Email-received: polls Connected Gmail on cron. Starts inbox_replies. Never sends.",
    },
    {
      kind: "webhook",
      enabled: false,
      note: "Signed webhook: POST /triggers/fire kind=webhook.",
    },
  ];
}

export function phase2Catalog() {
  return {
    title: "Cost controls",
    supervised: true,
    items: PHASE2_STATUS,
    eventTriggers: defaultEventTriggerStubs(),
  };
}
