import { AGENT_ROLES, playbookHintFromRole, type AgentRole } from "@/lib/constants";

export const DEFAULT_ROUTINE_CADENCE = "weekly_monday" as const;

export type RoutineDelivery = {
  slack: boolean;
  email: boolean;
  slackChannel?: string;
  emailTo?: string;
};

export function asAgentRoleSafe(value: string): AgentRole {
  return AGENT_ROLES.includes(value as AgentRole)
    ? (value as AgentRole)
    : playbookHintFromRole(value);
}

export function routineDeliveryNote(delivery: RoutineDelivery): string {
  const parts: string[] = [];
  if (delivery.slack) {
    parts.push(
      delivery.slackChannel
        ? `Slack #${delivery.slackChannel} after approval`
        : "Slack draft after approval (no channel — will not post)",
    );
  }
  if (delivery.email) {
    parts.push(
      delivery.emailTo
        ? `Gmail draft to ${delivery.emailTo} (never sent)`
        : "Gmail draft after approval (never sent)",
    );
  }
  return parts.length ? parts.join("; ") : "Desk only — nothing leaves without a later approval.";
}
