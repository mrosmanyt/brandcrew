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
};

export function cloudOrigin(envUrl?: string) {
  return (envUrl || "https://app.cinem.tech").replace(/\/$/, "");
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
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "X-Cinem-Client": "assistant",
      ...(increment ? { "Content-Type": "application/json" } : {}),
    },
    body: increment ? JSON.stringify({ turns: input.turns }) : undefined,
  });
  const data = (await res.json()) as CinemAiAssistantUsageResponse & { error?: string };
  if (!res.ok && !data.upgradeUrl) {
    throw new Error(data.error || `Usage request failed (${res.status})`);
  }
  return data;
}

/** Open the existing CINEM Pro Whop checkout in the system browser. */
export function assistantUpgradeUrl(origin?: string) {
  const base = cloudOrigin(origin);
  return `${base}/billing?plan=pro&product=${CINEM_AI_ASSISTANT_PRODUCT}`;
}
