/**
 * Cinem AI Assistant — Windows desktop product.
 * Standalone billing at /cinem-ai-assistant/billing. Desk plans may still include it.
 */

import {
  assistantBillingPath,
  assistantCheckoutPath,
  parseAssistantBillingPlanId,
} from "@/lib/cinem-ai-assistant-billing";
import { planDisplayName, type CheckoutPlanId, type PlanId } from "@/lib/constants";
import { isPaidPlan, normalizePlanId } from "@/lib/limits";
import {
  CINEM_AI_ASSISTANT_SETUP_FILENAME,
  DESKTOP_AI_ASSISTANT_ADVANCED_DOWNLOAD,
  DESKTOP_WIN_DOWNLOAD,
  SITE_ORIGIN,
  WIN_SETUP_FILENAME,
  siteOrigin,
} from "@/lib/site";

export const CINEM_AI_ASSISTANT_PRODUCT = "cinem-ai-assistant";
export const CINEM_AI_ASSISTANT_NAME = "Cinem AI Assistant";
export const CINEM_AI_ASSISTANT_PATH = "/cinem-ai-assistant";
export { CINEM_AI_ASSISTANT_SETUP_FILENAME };
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
    title: "Standalone plans",
    body: "Free includes 500 turns / month. Paid assistant plans unlock everything — billed separately at /cinem-ai-assistant/billing.",
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

export type WorkspacePlanRow = {
  id?: string | null;
  plan?: string | null;
};

/**
 * Same CINEM Pro account = same plan on desktop.
 * Entitlement is the best workspace plan the signed-in user belongs to
 * (Pro $20 `starter`, Pro Plus `pro`, Ultra `ultra`) — not the first desk
 * created, and not a stale Free snapshot.
 */
export function entitlementFromWorkspaces(
  workspaces: WorkspacePlanRow[],
  opts?: { assistantFoundingMember?: boolean },
) {
  const plan = bestPlanId(workspaces.map((row) => row.plan));
  const match =
    workspaces.find((row) => row.id && normalizePlanId(row.plan) === plan) ||
    workspaces.find((row) => row.id);
  const paid = isPaidPlan(plan);
  const foundingMember = Boolean(opts?.assistantFoundingMember);
  return {
    plan,
    workspaceId: match?.id ?? null,
    planName: foundingMember && !paid ? "Founding Free" : planDisplayName(plan),
    includedWithPlan: paid || foundingMember,
    foundingMember,
  };
}

/** Upgrade wall / HTTP 402 is Free-only. Paid desks never see a false upgrade. */
export function shouldPromptAssistantUpgrade(snapshot: {
  allowed: boolean;
  includedWithPlan?: boolean;
  plan?: string | null;
}) {
  if (snapshot.includedWithPlan) return false;
  if (isPaidPlan(snapshot.plan)) return false;
  return snapshot.allowed === false;
}

export function assistantUsageHttpStatus(snapshot: {
  allowed: boolean;
  includedWithPlan?: boolean;
  plan?: string | null;
}) {
  return shouldPromptAssistantUpgrade(snapshot) ? 402 : 200;
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

export function cinemAiAssistantBillingPath(planDisplay = "monthly") {
  const plan = parseAssistantBillingPlanId(planDisplay) || "monthly";
  return assistantBillingPath(plan);
}

export function cinemAiAssistantUpgradeUrl(origin?: string | null, planDisplay = "monthly") {
  const base = (origin || siteOrigin() || SITE_ORIGIN).replace(/\/$/, "");
  const plan = parseAssistantBillingPlanId(planDisplay) || "monthly";
  return `${base}${assistantCheckoutPath(plan)}`;
}

export function cinemAiAssistantSetupEnvUrl() {
  return (
    process.env.NEXT_PUBLIC_CINEM_AI_ASSISTANT_SETUP_URL?.trim() ||
    process.env.CINEM_AI_ASSISTANT_SETUP_URL?.trim() ||
    ""
  );
}

/** True when the URL is an absolute https asset off the app origin (CDN / GitHub Releases). */
export function isExternalDirectInstallerUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "app.cinem.tech" ||
      host === "app.cinem.pro" ||
      host === "brandcrew.vercel.app" ||
      host.endsWith(".vercel.app")
    ) {
      return false;
    }
    if (parsed.pathname.startsWith("/api/") || parsed.pathname.startsWith("/downloads/")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Optional env override — only honored when it points at a real external CDN, not the app server. */
export function validatedDesktopInstallerEnvUrl() {
  const raw = cinemAiAssistantSetupEnvUrl();
  return raw && isExternalDirectInstallerUrl(raw) ? raw : "";
}

export function cinemAiAssistantReleaseUrl() {
  return DESKTOP_WIN_DOWNLOAD;
}

export function cinemAiAssistantAdvancedReleaseUrl() {
  return DESKTOP_AI_ASSISTANT_ADVANCED_DOWNLOAD;
}

/** Public download CTA. Env override (external CDN only), else GitHub Releases latest asset. */
export function cinemAiAssistantDownloadHref() {
  return validatedDesktopInstallerEnvUrl() || DESKTOP_WIN_DOWNLOAD;
}

export function cinemAiAssistantAdvancedDownloadHref() {
  return cinemAiAssistantAdvancedReleaseUrl();
}

export function usageSnapshot(input: {
  plan?: string | null;
  used: number;
  period?: string;
  upgradeUrl: string;
  workspaceId?: string | null;
  includedWithPlan?: boolean;
  foundingMember?: boolean;
  /** Post–first-50 demo users — assistant requires paid plan. */
  gatePaidOnly?: boolean;
  /** Extra turns from viral +1 free month redemptions. */
  referralBonusMonths?: number;
}): CinemAiAssistantUsageSnapshot {
  const plan = normalizePlanId(input.plan);
  const paid = isPaidPlan(plan);
  const included =
    input.includedWithPlan ?? (paid || Boolean(input.foundingMember));
  const gatePaidOnly = Boolean(input.gatePaidOnly && !included);
  const referralBonus = Math.max(0, Math.floor(input.referralBonusMonths ?? 0));
  const referralTurns = referralBonus * CINEM_AI_ASSISTANT_FREE_TURNS;
  const limit = gatePaidOnly ? referralTurns : cinemAiAssistantTurnLimit(plan) + referralTurns;
  const used = Math.max(0, Math.floor(input.used));
  const remaining = Math.max(0, limit - used);
  return {
    product: CINEM_AI_ASSISTANT_PRODUCT,
    name: CINEM_AI_ASSISTANT_NAME,
    plan,
    planName: input.foundingMember && !paid ? "Founding Free" : planDisplayName(plan),
    paid,
    includedWithPlan: included,
    meter: "chat_voice_turns",
    period: input.period || cinemAiAssistantPeriodUtc(),
    used,
    limit,
    remaining,
    allowed: gatePaidOnly ? false : remaining > 0,
    upgradeUrl: input.upgradeUrl,
    workspaceId: input.workspaceId ?? null,
  };
}

export function clampUsageIncrement(raw?: unknown) {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(50, Math.floor(n)));
}
