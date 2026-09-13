/**
 * Cinem AI Assistant — Windows desktop feature on existing CINEM Pro plans.
 * Not a separate Whop product. Free is metered; Pro / Pro Plus / Ultra include it.
 */

import { planDisplayName, type CheckoutPlanId, type PlanId } from "@/lib/constants";
import { isPaidPlan, normalizePlanId } from "@/lib/limits";
import {
  DESKTOP_WIN_DOWNLOAD,
  PUBLIC_RELEASES_REPO,
  SITE_ORIGIN,
  WIN_SETUP_FILENAME,
  siteOrigin,
} from "@/lib/site";

export const CINEM_AI_ASSISTANT_PRODUCT = "cinem-ai-assistant";
export const CINEM_AI_ASSISTANT_NAME = "Cinem AI Assistant";
export const CINEM_AI_ASSISTANT_PATH = "/cinem-ai-assistant";
export const CINEM_AI_ASSISTANT_SETUP_FILENAME = "Cinem-AI-Assistant-Setup.exe";
/** Primary Windows installer — Desk + AI Assistant in one NSIS Setup.exe. */
export const CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME = WIN_SETUP_FILENAME;
export const CINEM_AI_ASSISTANT_PUBLIC_PATH = `/downloads/${CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME}`;
export const CINEM_AI_ASSISTANT_ADVANCED_PUBLIC_PATH = `/downloads/${CINEM_AI_ASSISTANT_SETUP_FILENAME}`;
export const CINEM_AI_ASSISTANT_DOWNLOAD_API = "/api/downloads/cinem-ai-assistant";
export const CINEM_AI_ASSISTANT_USAGE_API = "/api/cinem-ai-assistant/usage";
export const CINEM_AI_ASSISTANT_DOCS = "docs/cinem-ai-assistant.md";

/** Free plan: 500 chat/voice turns per UTC month. */
export const CINEM_AI_ASSISTANT_FREE_TURNS = 500;

/**
 * Paid desks include the assistant. Caps stay high (“unlimited-ish”) so
 * Pro / Pro Plus / Ultra are not a second purchase — they reuse plan entitlements.
 */
export const CINEM_AI_ASSISTANT_TURN_LIMIT: Record<PlanId, number> = {
  demo: CINEM_AI_ASSISTANT_FREE_TURNS,
  starter: 20_000,
  pro: 50_000,
  ultra: 120_000,
};

export const PLAN_RANK: Record<PlanId, number> = {
  demo: 0,
  starter: 1,
  pro: 2,
  ultra: 3,
};

export type CinemAiAssistantUsageSnapshot = {
  product: typeof CINEM_AI_ASSISTANT_PRODUCT;
  name: typeof CINEM_AI_ASSISTANT_NAME;
  plan: PlanId;
  planName: string;
  paid: boolean;
  includedWithPlan: boolean;
  meter: "chat_voice_turns";
  period: string;
  used: number;
  limit: number;
  remaining: number;
  allowed: boolean;
  upgradeUrl: string;
  workspaceId: string | null;
};

export type CinemAiAssistantFeature = {
  id: string;
  title: string;
  body: string;
};

export const CINEM_AI_ASSISTANT_FEATURES: CinemAiAssistantFeature[] = [
  {
    id: "voice",
    title: "Voice Jarvis",
    body: "Talk to the assistant on Windows. Chat and voice share one monthly turn meter on Free.",
  },
  {
    id: "agents",
    title: "Agents",
    body: "Spin up multi-step work from the same CINEM Pro account that runs the web desk.",
  },
  {
    id: "vision",
    title: "Vision",
    body: "Show the assistant what is on screen. Perception stays on your machine until a turn is sent.",
  },
  {
    id: "chat",
    title: "Desk chat",
    body: "Same login as app.cinem.tech. Session JWT or device token — no second account.",
  },
  {
    id: "windows",
    title: "Windows native",
    body: "One Windows installer (CINEM-Pro-Setup.exe) opens Desk and AI Assistant. Mac and Linux use the web desk.",
  },
  {
    id: "upgrade",
    title: "Included with CINEM Pro",
    body: "Free includes 500 turns / month. Pro, Pro Plus, and Ultra include the assistant — upgrade on the existing billing page.",
  },
];

export function cinemAiAssistantPeriodUtc(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function cinemAiAssistantTurnLimit(plan?: string | null) {
  return CINEM_AI_ASSISTANT_TURN_LIMIT[normalizePlanId(plan)];
}

export function bestPlanId(plans: Array<string | null | undefined>): PlanId {
  let best: PlanId = "demo";
  for (const raw of plans) {
    const id = normalizePlanId(raw);
    if (PLAN_RANK[id] > PLAN_RANK[best]) best = id;
  }
  return best;
}

export function isCinemAiAssistantProduct(raw?: string | null) {
  const id = String(raw || "")
    .trim()
    .toLowerCase();
  return id === CINEM_AI_ASSISTANT_PRODUCT || id === "assistant" || id === "";
}

/**
 * Marketing “Pro” on this product is the existing $20 plan (internal `starter`).
 * `plan=pro` here must not open Pro Plus ($79).
 */
export function assistantCheckoutPlanFromQuery(
  raw?: string | null,
  product?: string | null,
): CheckoutPlanId | null {
  if (!isCinemAiAssistantProduct(product) && product != null && String(product).trim()) {
    return null;
  }
  const id = String(raw || "")
    .trim()
    .toLowerCase();
  if (!id || id === "pro" || id === "starter") return "starter";
  if (id === "pro-plus" || id === "proplus" || id === "plus" || id === "growth") return "pro";
  if (id === "ultra") return "ultra";
  return null;
}

export function cinemAiAssistantBillingPath(planDisplay = "pro") {
  const params = new URLSearchParams({
    plan: planDisplay,
    product: CINEM_AI_ASSISTANT_PRODUCT,
  });
  return `/billing?${params.toString()}`;
}

export function cinemAiAssistantUpgradeUrl(origin?: string | null, planDisplay = "pro") {
  const base = (origin || siteOrigin() || SITE_ORIGIN).replace(/\/$/, "");
  return `${base}${cinemAiAssistantBillingPath(planDisplay)}`;
}

export function cinemAiAssistantSetupEnvUrl() {
  return (
    process.env.NEXT_PUBLIC_CINEM_AI_ASSISTANT_SETUP_URL?.trim() ||
    process.env.CINEM_AI_ASSISTANT_SETUP_URL?.trim() ||
    ""
  );
}

export function cinemAiAssistantReleaseUrl() {
  return DESKTOP_WIN_DOWNLOAD;
}

export function cinemAiAssistantAdvancedReleaseUrl() {
  return `${PUBLIC_RELEASES_REPO}/releases/latest/download/${CINEM_AI_ASSISTANT_SETUP_FILENAME}`;
}

/** Public download CTA. Env override, else the unified CINEM-Pro-Setup.exe. */
export function cinemAiAssistantDownloadHref() {
  return cinemAiAssistantSetupEnvUrl() || DESKTOP_WIN_DOWNLOAD;
}

export function cinemAiAssistantAdvancedDownloadHref() {
  return `${CINEM_AI_ASSISTANT_DOWNLOAD_API}?advanced=1`;
}

export function usageSnapshot(input: {
  plan?: string | null;
  used: number;
  period?: string;
  upgradeUrl: string;
  workspaceId?: string | null;
}): CinemAiAssistantUsageSnapshot {
  const plan = normalizePlanId(input.plan);
  const limit = cinemAiAssistantTurnLimit(plan);
  const used = Math.max(0, Math.floor(input.used));
  const remaining = Math.max(0, limit - used);
  const paid = isPaidPlan(plan);
  return {
    product: CINEM_AI_ASSISTANT_PRODUCT,
    name: CINEM_AI_ASSISTANT_NAME,
    plan,
    planName: planDisplayName(plan),
    paid,
    includedWithPlan: paid,
    meter: "chat_voice_turns",
    period: input.period || cinemAiAssistantPeriodUtc(),
    used,
    limit,
    remaining,
    allowed: remaining > 0,
    upgradeUrl: input.upgradeUrl,
    workspaceId: input.workspaceId ?? null,
  };
}

export function clampUsageIncrement(raw?: unknown) {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(50, Math.floor(n)));
}
