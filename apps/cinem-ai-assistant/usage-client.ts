/**
 * Minimal usage client for the Windows Tauri app.
 * Copy into the imported renderer, or point Vite at this file.
 * Types stay aligned with `src/lib/cinem-ai-assistant.ts`.
 */

export const CINEM_AI_ASSISTANT_PRODUCT = "cinem-ai-assistant";
export const CINEM_AI_ASSISTANT_USAGE_PATH = "/api/cinem-ai-assistant/usage";

export type CinemAiAssistantUsageResponse = {
  product: string;
  plan: string;
  planName: string;
  allowed: boolean;
  remaining: number;
  upgradeUrl: string;
  used: number;
  limit: number;
  period: string;
  includedWithPlan: boolean;
  meter: "chat_voice_turns";
  pro?: boolean;
  foundingMember?: boolean;
  proRequired?: boolean;
  sunsetBanner?: boolean;
  cutoffAt?: string | null;
  whatsappUrl?: string;
  code?: string;
  error?: string;
};

export const ASSISTANT_SALES_WHATSAPP_URL = "https://wa.me/923489057646";

export function shouldHardLockAssistant(usage?: {
  proRequired?: boolean;
  code?: string | null;
} | null) {
  return Boolean(usage?.proRequired || usage?.code === "PRO_REQUIRED");
}

export function cloudOrigin(envUrl?: string) {
  return (envUrl || "https://app.cinem.tech").replace(/\/$/, "");
}

export function shouldPromptAssistantUpgrade(usage?: {
  allowed?: boolean;
  includedWithPlan?: boolean;
  plan?: string;
  pro?: boolean;
  proRequired?: boolean;
  code?: string | null;
} | null) {
  if (!usage) return false;
  if (shouldHardLockAssistant(usage)) return false;
  if (usage.pro || usage.includedWithPlan) return false;
  const plan = String(usage.plan || "").toLowerCase();
  if (plan && plan !== "demo" && plan !== "free") return false;
  return usage.allowed === false;
}

/** Client-side Pro check before consumeTurn / local BYOK. Server still gates the meter. */
export function hasClientAssistantAccess(usage?: CinemAiAssistantUsageResponse | null) {
  if (!usage) return false;
  if (shouldHardLockAssistant(usage)) return false;
  if (usage.pro || usage.includedWithPlan || usage.foundingMember) return true;
  return usage.allowed !== false;
}

export async function fetchAssistantUsage(input: {
  origin?: string;
  accessToken: string;
  turns?: number;
}): Promise<CinemAiAssistantUsageResponse> {
  const base = cloudOrigin(input.origin);
  const increment = typeof input.turns === "number";
  const res = await fetch(`${base}${CINEM_AI_ASSISTANT_USAGE_PATH}`, {
    method: increment ? "POST" : "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "X-Cinem-Client": "assistant",
      ...(increment ? { "Content-Type": "application/json" } : {}),
    },
    body: increment ? JSON.stringify({ turns: input.turns }) : undefined,
  });
  const data = (await res.json()) as CinemAiAssistantUsageResponse & { error?: string };
  if (data.code === "PRO_REQUIRED" || (res.status === 402 && data.error === "Pro required")) {
    return {
      ...data,
      allowed: false,
      proRequired: true,
      code: "PRO_REQUIRED",
      upgradeUrl: data.upgradeUrl || assistantUpgradeUrl(base),
    };
  }
  if (!res.ok && !data.upgradeUrl) {
    throw new Error(data.error || `Usage request failed (${res.status})`);
  }
  return data;
}

/** Open standalone Cinem AI Assistant billing in the system browser. */
export function assistantUpgradeUrl(origin?: string) {
  const base = cloudOrigin(origin);
  return `${base}/billing?plan=monthly&product=${CINEM_AI_ASSISTANT_PRODUCT}`;
}
