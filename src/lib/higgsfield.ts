/**
 * Higgsfield API (Package 8 investigation → connector).
 *
 * Verified from Higgsfield's official developer docs
 * (https://docs.higgsfield.ai — Authentication, Quickstart, API
 * reference; model pages on https://open.higgsfield.ai):
 * - A public, key-based API exists. Base URL: https://api.higgsfield.ai
 * - Credentials are a key ID + secret pair, created in the Higgsfield
 *   Console (https://console.higgsfield.ai), sent server-side as
 *   `Authorization: Key <KEY_ID>:<KEY_SECRET>`. The API is a separate
 *   product from web plans: pay-per-use from a prepaid USD balance;
 *   web-plan "unlimited" does not apply to API calls.
 * - Generation is asynchronous: POST a model endpoint → request_id +
 *   status_url; poll GET /requests/{id}/status until a terminal state
 *   (completed / failed / nsfw / canceled). Outputs are kept ~7 days.
 * - Catalog includes the owner's Seedance models, e.g.
 *   POST /bytedance/seedance-2.5/text-to-video (also image-to-video,
 *   reference-to-video, video-edit, video-extend), Seedance 2.0, Kling,
 *   Veo, Wan, and the Soul image family (/higgsfield-ai/soul/v2/...).
 *
 * There is no account/models GET endpoint in the shared API reference,
 * so the credential check below uses the documented request-status
 * endpoint with an all-zero request id: the API answers 401 for bad
 * credentials, 403 for a disabled/expired key, and 404 when the key is
 * accepted but the request does not exist. Only 404 counts as valid.
 */
import { readHiggsfieldCredentials } from "@/lib/user-provider-keys";

const DEFAULT_BASE = "https://api.higgsfield.ai";
const ZERO_REQUEST_ID = "00000000-0000-0000-0000-000000000000";

export const HIGGSFIELD_DOCS_URL = "https://docs.higgsfield.ai";
export const HIGGSFIELD_CONSOLE_URL = "https://console.higgsfield.ai";

export type HiggsfieldCredentials = {
  keyId: string;
  secret: string;
};

export function higgsfieldBaseUrl() {
  return (process.env.HIGGSFIELD_BASE_URL?.trim() || DEFAULT_BASE).replace(/\/$/, "");
}

export function higgsfieldConfigured(creds: HiggsfieldCredentials | null): boolean {
  return Boolean(creds?.keyId && creds?.secret);
}

/** Model endpoints confirmed in Higgsfield's official API docs. */
export const HIGGSFIELD_MODELS: { id: string; label: string; kind: "video" | "image" }[] = [
  { id: "bytedance/seedance-2.5/text-to-video", label: "Seedance 2.5 — text to video", kind: "video" },
  { id: "bytedance/seedance-2.5/image-to-video", label: "Seedance 2.5 — image to video", kind: "video" },
  { id: "bytedance/seedance-2.5/reference-to-video", label: "Seedance 2.5 — reference to video", kind: "video" },
  { id: "bytedance/seedance-2.0/text-to-video", label: "Seedance 2.0 — text to video", kind: "video" },
  { id: "higgsfield-ai/soul/v2/standard", label: "Soul 2 — text to image", kind: "image" },
];

function authHeaders(creds: HiggsfieldCredentials) {
  return {
    Authorization: `Key ${creds.keyId}:${creds.secret}`,
    "Content-Type": "application/json",
    accept: "application/json",
  };
}

export type HiggsfieldValidation = {
  ok: boolean;
  /** HTTP status the API answered, or 0 for a network failure. */
  status: number;
  error: string | null;
};

/**
 * Real credential check against the live API (see header note). Never
 * marks a key valid on anything but the API accepting it (404 for the
 * probe request id).
 */
export async function validateHiggsfieldCredentials(
  creds: HiggsfieldCredentials,
): Promise<HiggsfieldValidation> {
  try {
    const res = await fetch(
      `${higgsfieldBaseUrl()}/requests/${ZERO_REQUEST_ID}/status`,
      { headers: authHeaders(creds) },
    );
    if (res.status === 404) return { ok: true, status: 404, error: null };
    if (res.status === 401) {
      return {
        ok: false,
        status: 401,
        error: "The API rejected this key ID / secret pair (401). Check both values in the Higgsfield Console.",
      };
    }
    if (res.status === 403) {
      return {
        ok: false,
        status: 403,
        error: "This API key is disabled or expired (403). Create a fresh key in the Higgsfield Console.",
      };
    }
    return {
      ok: false,
      status: res.status,
      error: `Unexpected answer from the Higgsfield API (HTTP ${res.status}) — the key was not confirmed.`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Could not reach the Higgsfield API.",
    };
  }
}

export async function validateStoredHiggsfieldKey(
  userId: string,
): Promise<HiggsfieldValidation & { configured: boolean }> {
  const creds = await readHiggsfieldCredentials(userId);
  if (!higgsfieldConfigured(creds)) {
    return {
      configured: false,
      ok: false,
      status: 0,
      error: "No Higgsfield API key saved yet. Add your key ID and secret first.",
    };
  }
  const result = await validateHiggsfieldCredentials(creds as HiggsfieldCredentials);
  return { configured: true, ...result };
}

export type HiggsfieldSubmission = {
  ok: boolean;
  requestId: string;
  statusUrl: string;
  error: string | null;
};

/**
 * Submit a generation to a documented model endpoint (async lifecycle).
 * Returns the request handle; poll getHiggsfieldRequestStatus for the
 * result. Spends from the key owner's prepaid API balance — callers
 * must treat this as a paid action.
 */
export async function submitHiggsfieldGeneration(input: {
  creds: HiggsfieldCredentials;
  model: string;
  body: Record<string, unknown>;
}): Promise<HiggsfieldSubmission> {
  try {
    const res = await fetch(`${higgsfieldBaseUrl()}/${input.model}`, {
      method: "POST",
      headers: authHeaders(input.creds),
      body: JSON.stringify(input.body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        requestId: "",
        statusUrl: "",
        error: String(data.error || data.message || `Higgsfield API HTTP ${res.status}`),
      };
    }
    return {
      ok: true,
      requestId: String(data.request_id || ""),
      statusUrl: String(data.status_url || ""),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      requestId: "",
      statusUrl: "",
      error: error instanceof Error ? error.message : "Higgsfield submission failed.",
    };
  }
}

/** Poll the documented status endpoint for a submitted request. */
export async function getHiggsfieldRequestStatus(input: {
  creds: HiggsfieldCredentials;
  requestId: string;
}) {
  try {
    const res = await fetch(
      `${higgsfieldBaseUrl()}/requests/${encodeURIComponent(input.requestId)}/status`,
      { headers: authHeaders(input.creds) },
    );
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false as const,
        status: "",
        data,
        error: String(data.error || data.message || `Higgsfield API HTTP ${res.status}`),
      };
    }
    return { ok: true as const, status: String(data.status || ""), data, error: null as string | null };
  } catch (error) {
    return {
      ok: false as const,
      status: "",
      data: {} as Record<string, unknown>,
      error: error instanceof Error ? error.message : "Higgsfield status check failed.",
    };
  }
}
