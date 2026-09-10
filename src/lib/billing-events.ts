import type { CheckoutPlanId } from "@/lib/constants";
import { normalizePlanId } from "@/lib/limits";

export type WhopWebhookEnvelope = {
  id?: unknown;
  type?: unknown;
  data?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function readMetaString(metadata: unknown, ...keys: string[]) {
  const meta = asRecord(metadata);
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function normalizeWhopEventType(type: unknown) {
  if (typeof type !== "string") return "";
  return type.trim().replace(/_/g, ".");
}

export function isPaidUnlockEvent(type: string) {
  return type === "payment.succeeded" || type === "membership.activated";
}

export function isMembershipDeactivatedEvent(type: string) {
  return type === "membership.deactivated";
}

export function nestedId(value: unknown, ...keys: string[]) {
  const record = asRecord(value);
  for (const key of keys) {
    const direct = record[key];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    const nested = asRecord(direct).id;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }
  return null;
}

export function extractWhopResource(data: unknown) {
  const record = asRecord(data);
  const id = typeof record.id === "string" ? record.id : null;
  const membershipId =
    (id && id.startsWith("mem_") ? id : null) ||
    nestedId(record, "membership", "membership_id");
  return {
    id,
    metadata: record.metadata,
    workspaceId: readMetaString(record.metadata, "workspaceId", "workspace_id"),
    planHint: readMetaString(record.metadata, "plan", "planId", "plan_id"),
    planId: nestedId(record, "plan", "plan_id"),
    membershipId,
    paymentId: id && id.startsWith("pay_") ? id : nestedId(record, "payment", "payment_id"),
  };
}

export function resolvePaidPlanFromWhop(input: {
  metadata?: unknown;
  planId?: string | null;
}): CheckoutPlanId | null {
  const hinted = readMetaString(input.metadata, "plan", "planId", "plan_id");
  if (hinted) {
    const id = normalizePlanId(hinted);
    if (id === "starter" || id === "pro" || id === "ultra") return id;
  }
  const planId = input.planId?.trim();
  if (!planId) return null;
  if (planId === process.env.WHOP_STARTER_PLAN_ID?.trim()) return "starter";
  if (
    planId === process.env.WHOP_PRO_PLAN_ID?.trim() ||
    planId === process.env.WHOP_GROWTH_PLAN_ID?.trim()
  ) {
    return "pro";
  }
  if (planId === process.env.WHOP_ULTRA_PLAN_ID?.trim()) return "ultra";
  return null;
}

/**
 * Cancel / deactivate → Free (stored plan id `demo`) when this membership
 * is the one that granted the current paid plan. A stale starter-id cancel after
 * an Ultra upgrade is ignored.
 */
export function shouldDowngradeToDemo(input: {
  currentPlan: string;
  deactivatedPlan: string | null;
  membershipMatches: boolean;
}) {
  const current = normalizePlanId(input.currentPlan);
  if (current === "demo") return false;
  if (input.membershipMatches) return true;
  if (!input.deactivatedPlan) return false;
  return normalizePlanId(input.deactivatedPlan) === current;
}

export function parseWhopEnvelope(body: unknown): {
  type: string;
  data: unknown;
  eventId: string | null;
} {
  const envelope = asRecord(body);
  return {
    type: normalizeWhopEventType(envelope.type),
    data: envelope.data ?? body,
    eventId: typeof envelope.id === "string" ? envelope.id : null,
  };
}
