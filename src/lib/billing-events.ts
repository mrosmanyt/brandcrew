import {
  resolveAssistantBillingPlanFromWhopPlanId,
  type AssistantBillingPlanId,
} from "@/lib/cinem-ai-assistant-billing";
import { CINEM_AI_ASSISTANT_PRODUCT } from "@/lib/cinem-ai-assistant";
import type { CheckoutPlanId } from "@/lib/constants";
import { normalizePlanId } from "@/lib/limits";
import {
  isSupportPlanId,
  parseSupportAmountUsd,
  supportAmountCents,
  SUPPORT_KIND,
} from "@/lib/support";

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

function nestedEmail(value: unknown) {
  const record = asRecord(value);
  const direct = record.email;
  if (typeof direct === "string" && direct.trim()) return direct.trim().toLowerCase();
  const user = asRecord(record.user);
  if (typeof user.email === "string" && user.email.trim()) {
    return user.email.trim().toLowerCase();
  }
  const member = asRecord(record.member);
  if (typeof member.email === "string" && member.email.trim()) {
    return member.email.trim().toLowerCase();
  }
  return null;
}

function readUsdFromRecord(record: Record<string, unknown>) {
  const metaUsd = parseSupportAmountUsd(
    readMetaString(record.metadata, "amountUsd", "amount_usd", "amount"),
  );
  if (metaUsd !== null) return metaUsd;
  for (const key of ["usd_total", "usd_amount", "total", "amount", "subtotal", "final_amount"]) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      // Whop payment totals are dollars when < 1e5 and look like prices; cents when large integers.
      if (Number.isInteger(value) && value >= 100_000) return value / 100;
      return value;
    }
    if (typeof value === "string") {
      const parsed = parseSupportAmountUsd(value);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

export function extractWhopResource(data: unknown) {
  const record = asRecord(data);
  const id = typeof record.id === "string" ? record.id : null;
  const membershipId =
    (id && id.startsWith("mem_") ? id : null) ||
    nestedId(record, "membership", "membership_id");
  const amountUsd = readUsdFromRecord(record);
  return {
    id,
    metadata: record.metadata,
    workspaceId: readMetaString(record.metadata, "workspaceId", "workspace_id"),
    userId: readMetaString(record.metadata, "userId", "user_id"),
    kind: readMetaString(record.metadata, "kind"),
    planHint: readMetaString(record.metadata, "plan", "planId", "plan_id"),
    planId: nestedId(record, "plan", "plan_id"),
    membershipId,
    paymentId: id && id.startsWith("pay_") ? id : nestedId(record, "payment", "payment_id"),
    email: nestedEmail(record) || readMetaString(record.metadata, "email"),
    amountUsd,
    amountCents: amountUsd !== null ? supportAmountCents(amountUsd) : 0,
  };
}

export function isAssistantProductCheckout(metadata?: unknown) {
  const product = readMetaString(metadata, "product");
  return product === CINEM_AI_ASSISTANT_PRODUCT;
}

export function resolveAssistantPlanFromWhop(input: {
  metadata?: unknown;
  planId?: string | null;
}): AssistantBillingPlanId | null {
  const hinted = readMetaString(input.metadata, "plan", "planId", "plan_id");
  if (hinted === "monthly" || hinted === "3mo" || hinted === "6mo" || hinted === "1yr") {
    return hinted;
  }
  return resolveAssistantBillingPlanFromWhopPlanId(input.planId);
}

export function isSupportCheckout(input: {
  metadata?: unknown;
  planId?: string | null;
  kind?: string | null;
  planHint?: string | null;
}) {
  const kind = input.kind || readMetaString(input.metadata, "kind");
  if (kind === SUPPORT_KIND || kind === "tip") return true;
  const planHint =
    input.planHint ||
    readMetaString(input.metadata, "plan", "planId", "plan_id");
  if (planHint === SUPPORT_KIND || planHint === "tip") return true;
  return isSupportPlanId(input.planId);
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
