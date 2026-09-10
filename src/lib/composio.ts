/**
 * Composio Platform layer — official @composio/core sessions.
 * One vendor, many connectors. Key from process.env.COMPOSIO_API_KEY only.
 * Never marks Connected without the key + an ACTIVE connected account
 * (no-auth toolkits like Hacker News can prove a real tool call without OAuth).
 *
 * Docs used: https://docs.composio.dev/docs/quickstart.md
 *            https://docs.composio.dev/docs/configuring-sessions.md
 *            https://docs.composio.dev/docs/authentication.md
 *            https://docs.composio.dev/reference/sdk-reference/typescript/session.md
 *            https://docs.composio.dev/toolkits/gmail.md
 *            https://docs.composio.dev/toolkits/hackernews.md
 */

import { Composio } from "@composio/core";
import { ClientError } from "@/lib/http";
import { oauthRedirectBase } from "@/lib/crypto-secret";
import {
  COMPOSIO_AGENCY_TOOLKITS,
  composioPluginId,
  composioUserId,
  getComposioToolkit,
  isComposioPluginId,
  type ComposioToolkitDef,
} from "@/lib/composio-catalog";

export {
  COMPOSIO_AGENCY_TOOLKITS,
  composioPluginId,
  composioUserId,
  getComposioToolkit,
  isComposioPluginId,
};

const DEFAULT_BASE = "https://backend.composio.dev/api/v3.1";

export function composioApiKey() {
  return (process.env.COMPOSIO_API_KEY || "").trim();
}

export function composioConfigured() {
  const key = composioApiKey();
  if (!key) return false;
  if (/^(your_|changeme|placeholder|xxx)/i.test(key)) return false;
  return true;
}

export function composioBaseUrl() {
  const raw = (process.env.COMPOSIO_BASE_URL || DEFAULT_BASE).trim();
  return raw.replace(/\/$/, "");
}

export function composioMissingHint() {
  return "Set COMPOSIO_API_KEY on the server (Vercel env or local .env). Connect stays disconnected — CINEM Pro does not fake Connected.";
}

let sdkSingleton: Composio | null = null;

/** Official SDK. Reads COMPOSIO_API_KEY from the environment — never pass the key inline. */
export function getComposioSdk(): Composio | null {
  if (!composioConfigured()) return null;
  if (!sdkSingleton) sdkSingleton = new Composio();
  return sdkSingleton;
}

export function resetComposioSdkForTests() {
  sdkSingleton = null;
}

export async function createWorkspaceSession(
  workspaceId: string,
  options?: { toolkits?: string[]; callbackUrl?: string },
) {
  const sdk = getComposioSdk();
  if (!sdk) throw new ClientError(composioMissingHint());
  return sdk.create(composioUserId(workspaceId), {
    ...(options?.toolkits?.length ? { toolkits: options.toolkits } : {}),
    ...(options?.callbackUrl ? { manageConnections: { callbackUrl: options.callbackUrl } } : {}),
  });
}

export type ComposioHttpResult = {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
  error?: string;
};

export async function composioRequest(
  path: string,
  init: RequestInit = {},
): Promise<ComposioHttpResult> {
  const key = composioApiKey();
  if (!key) {
    return { ok: false, status: 0, data: {}, error: composioMissingHint() };
  }
  const url = path.startsWith("http") ? path : `${composioBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-api-key": key,
        ...(init.headers || {}),
      },
    });
    let data: Record<string, unknown> = {};
    const text = await res.text();
    if (text) {
      try {
        const parsed = JSON.parse(text) as unknown;
        data =
          parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : { items: parsed };
      } catch {
        data = { raw: text.slice(0, 400) };
      }
    }
    if (!res.ok) {
      const error = String(
        data.error ||
          data.message ||
          (data.error_description as string) ||
          `Composio HTTP ${res.status}`,
      );
      return { ok: false, status: res.status, data, error };
    }
    return { ok: true, status: res.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: {},
      error: error instanceof Error ? error.message : "Composio request failed.",
    };
  }
}

function asItems(data: Record<string, unknown>): Record<string, unknown>[] {
  const items = data.items ?? data.data ?? data.connected_accounts ?? data.auth_configs;
  if (Array.isArray(items)) {
    return items.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  }
  return [];
}

export function parseConnectedStatus(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toUpperCase();
}

export function isComposioActiveStatus(status: string) {
  return parseConnectedStatus(status) === "ACTIVE";
}

export type ComposioAccount = {
  id: string;
  toolkit: string;
  status: string;
  userId?: string;
};

export function parseComposioAccount(row: Record<string, unknown>): ComposioAccount | null {
  const id = String(row.id || row.nanoid || row.connected_account_id || "").trim();
  if (!id) return null;
  const toolkitRaw = row.toolkit;
  const toolkit =
    typeof toolkitRaw === "object" && toolkitRaw
      ? String((toolkitRaw as { slug?: string }).slug || "")
      : String(row.toolkit_slug || row.appName || row.app_name || "");
  return {
    id,
    toolkit: toolkit.toLowerCase(),
    status: parseConnectedStatus(row.status),
    userId: String(row.user_id || row.userId || "").trim() || undefined,
  };
}

export async function listComposioAccounts(workspaceId: string, toolkitSlug?: string) {
  if (!composioConfigured()) {
    return { ok: false as const, error: composioMissingHint(), accounts: [] as ComposioAccount[] };
  }
  try {
    const session = await createWorkspaceSession(workspaceId, {
      toolkits: toolkitSlug ? [toolkitSlug] : undefined,
    });
    const listed = await session.toolkits(toolkitSlug ? { toolkits: [toolkitSlug] } : undefined);
    const accounts: ComposioAccount[] = [];
    for (const item of listed.items) {
      const connected = item.connection?.connectedAccount;
      if (!connected?.id) continue;
      accounts.push({
        id: connected.id,
        toolkit: item.slug.toLowerCase(),
        status: parseConnectedStatus(connected.status),
      });
    }
    return { ok: true as const, accounts };
  } catch (error) {
    const params = new URLSearchParams();
    params.set("user_ids", composioUserId(workspaceId));
    if (toolkitSlug) params.set("toolkit_slugs", toolkitSlug);
    const result = await composioRequest(`/connected_accounts?${params.toString()}`);
    if (!result.ok) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : result.error || "Could not list Composio accounts.",
        accounts: [] as ComposioAccount[],
      };
    }
    const accounts = asItems(result.data)
      .map(parseComposioAccount)
      .filter((row): row is ComposioAccount => Boolean(row));
    return { ok: true as const, accounts };
  }
}

export async function getActiveComposioAccount(workspaceId: string, toolkitSlug: string) {
  const listed = await listComposioAccounts(workspaceId, toolkitSlug);
  if (!listed.ok) return { ok: false as const, error: listed.error, account: null };
  const account = listed.accounts.find((row) => row.toolkit === toolkitSlug && isComposioActiveStatus(row.status));
  return { ok: true as const, account: account ?? null };
}

export type ComposioLinkStart = {
  redirectUrl: string;
  connectionId?: string;
  authConfigId?: string;
};

export function composioCallbackUrl(input: { workspaceId: string; pluginId: string; userId: string }) {
  const url = new URL(`${oauthRedirectBase()}/api/composio/callback`);
  url.searchParams.set("workspaceId", input.workspaceId);
  url.searchParams.set("pluginId", input.pluginId);
  url.searchParams.set("userId", input.userId);
  return url.toString();
}

function redirectFromUnknown(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const row = value as Record<string, unknown>;
  const nested = row.connection && typeof row.connection === "object" ? (row.connection as Record<string, unknown>) : {};
  return String(
    row.redirectUrl || row.redirect_url || row.link || nested.redirectUrl || nested.redirect_url || "",
  ).trim();
}

export async function startComposioLink(input: {
  workspaceId: string;
  pluginId: string;
  userId: string;
  apiKey?: string;
}): Promise<ComposioLinkStart> {
  if (!composioConfigured()) {
    throw new ClientError(composioMissingHint());
  }
  const toolkit = getComposioToolkit(input.pluginId);
  if (!toolkit) throw new ClientError("Unknown Composio toolkit.");

  const callback_url = composioCallbackUrl({
    workspaceId: input.workspaceId,
    pluginId: toolkit.id,
    userId: input.userId,
  });

  const session = await createWorkspaceSession(input.workspaceId, {
    toolkits: [toolkit.slug],
    callbackUrl: callback_url,
  });

  if (toolkit.auth === "api_key") {
    const pasted = input.apiKey?.trim() || "";
    if (!pasted) {
      throw new ClientError(
        `Paste a ${toolkit.name} API key. Empty Connect stays disconnected.`,
      );
    }
    const created = await composioRequest("/connected_accounts", {
      method: "POST",
      body: JSON.stringify({
        auth_config: { id: await ensureAuthConfigId(toolkit) },
        connection: {
          user_id: composioUserId(input.workspaceId),
          state: { authScheme: "API_KEY", val: { api_key: pasted } },
        },
      }),
    });
    const account = created.ok ? parseComposioAccount(created.data) : null;
    if (!created.ok || !account || !isComposioActiveStatus(account.status)) {
      throw new ClientError(
        created.error || "Composio did not activate that API-key connection. Not marked Connected.",
      );
    }
    return { redirectUrl: "", connectionId: account.id };
  }

  const request = await session.authorize(toolkit.slug, { callbackUrl: callback_url });
  const redirectUrl = redirectFromUnknown(request);
  const connectionId = String(
    (request as { id?: string; connectedAccountId?: string }).id ||
      (request as { connectedAccountId?: string }).connectedAccountId ||
      "",
  ).trim();

  if (!redirectUrl && connectionId) {
    return { redirectUrl: "", connectionId };
  }
  if (!redirectUrl) {
    throw new ClientError(
      "Composio did not return a Connect Link. Not marked Connected. Open Marketplace after setting COMPOSIO_API_KEY.",
    );
  }
  return { redirectUrl, connectionId: connectionId || undefined };
}

async function ensureAuthConfigId(toolkit: ComposioToolkitDef): Promise<string> {
  const envKey = `COMPOSIO_${toolkit.slug.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_AUTH_CONFIG_ID`;
  const fromEnv = (process.env[envKey] || process.env.COMPOSIO_AUTH_CONFIG_ID || "").trim();
  if (fromEnv) return fromEnv;
  const listed = await composioRequest(`/auth_configs?toolkit_slug=${encodeURIComponent(toolkit.slug)}`);
  if (listed.ok) {
    const existing = asItems(listed.data)
      .map((row) => String(row.id || row.nanoid || "").trim())
      .find(Boolean);
    if (existing) return existing;
  }
  const created = await composioRequest("/auth_configs", {
    method: "POST",
    body: JSON.stringify({
      toolkit: { slug: toolkit.slug },
      auth_config: { type: "use_composio_managed_auth" },
    }),
  });
  const id = String(
    created.data.id ||
      created.data.nanoid ||
      (created.data.auth_config as { id?: string } | undefined)?.id ||
      "",
  ).trim();
  if (id) return id;
  throw new ClientError(
    created.error ||
      `Composio has no auth config for ${toolkit.name}. Create one in the dashboard or set ${envKey}.`,
  );
}

export async function fetchComposioAccount(accountId: string) {
  const result = await composioRequest(`/connected_accounts/${encodeURIComponent(accountId)}`);
  if (!result.ok) return { ok: false as const, error: result.error || "Unknown connected account." };
  const account = parseComposioAccount(result.data);
  if (!account) return { ok: false as const, error: "Composio returned no account id." };
  return { ok: true as const, account };
}

export function composioToolLooksLikeWrite(slug: string) {
  return /CREATE|UPDATE|DELETE|SEND|POST_|UPSERT|REMOVE|WRITE|PUBLISH/i.test(slug);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

function extractLogId(data: Record<string, unknown>) {
  return String(
    data.log_id ||
      data.logId ||
      data.request_id ||
      data.requestId ||
      (data.metadata && typeof data.metadata === "object"
        ? (data.metadata as { log_id?: string; logId?: string }).log_id ||
          (data.metadata as { logId?: string }).logId
        : "") ||
      "",
  ).trim();
}

export async function executeComposioTool(input: {
  workspaceId: string;
  toolkitSlug: string;
  toolSlug: string;
  arguments?: Record<string, unknown>;
  connectedAccountId?: string;
}) {
  if (!composioConfigured()) {
    return { ok: false as const, error: composioMissingHint(), data: {} as Record<string, unknown>, logId: "" };
  }
  try {
    const session = await createWorkspaceSession(input.workspaceId, {
      toolkits: [input.toolkitSlug],
    });
    const result = await session.execute(input.toolSlug, input.arguments || {});
    const data = asRecord(result);
    const failed =
      data.successful === false ||
      data.error ||
      (typeof data.successful === "undefined" && data.ok === false);
    if (failed) {
      return {
        ok: false as const,
        error: String(data.error || "Composio tool execute failed."),
        data,
        logId: extractLogId(data),
      };
    }
    return { ok: true as const, data, logId: extractLogId(data) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Composio tool execute failed.";
    return { ok: false as const, error: message, data: {} as Record<string, unknown>, logId: "" };
  }
}

export function formatComposioResult(data: Record<string, unknown>) {
  const nested = (data.data as Record<string, unknown> | undefined) || data;
  try {
    return JSON.stringify(nested, null, 2).slice(0, 8000);
  } catch {
    return String(nested).slice(0, 8000);
  }
}

function pickDiscoveredSlug(
  hits: Array<{ slug?: string; tool_slug?: string; name?: string }>,
  preferred: string,
) {
  const preferredUpper = preferred.toUpperCase();
  const slugs = hits
    .map((row) => String(row.slug || row.tool_slug || row.name || "").trim())
    .filter(Boolean);
  return slugs.find((slug) => slug.toUpperCase() === preferredUpper) || slugs[0] || preferred;
}

export type ComposioFirstCallResult = {
  ok: boolean;
  configured: boolean;
  toolkit: string;
  tool: string;
  logId: string;
  excerpt: string;
  error?: string;
  gmailConnected: boolean;
  connectHint?: string;
};

/**
 * Safe first tool call. Prefers Gmail profile when that account is ACTIVE.
 * Otherwise runs a no-auth Hacker News read so the SDK path is proven.
 */
export async function runComposioFirstCall(workspaceId: string): Promise<ComposioFirstCallResult> {
  if (!composioConfigured()) {
    return {
      ok: false,
      configured: false,
      toolkit: "",
      tool: "",
      logId: "",
      excerpt: "",
      error: composioMissingHint(),
      gmailConnected: false,
    };
  }

  const session = await createWorkspaceSession(workspaceId, {
    toolkits: ["gmail", "hackernews"],
  });

  const gmailState = await session.toolkits({ toolkits: ["gmail"] });
  const gmailItem = gmailState.items.find((row) => row.slug === "gmail");
  const gmailConnected = Boolean(
    gmailItem?.connection?.isActive ||
      (gmailItem?.connection?.connectedAccount &&
        isComposioActiveStatus(gmailItem.connection.connectedAccount.status)),
  );

  if (gmailConnected) {
    const found = await session.search({ query: "get gmail profile", toolkits: ["gmail"] });
    const hits = Array.isArray((found as { items?: unknown[] }).items)
      ? ((found as { items: Array<{ slug?: string; tool_slug?: string; name?: string }> }).items)
      : [];
    const tool = pickDiscoveredSlug(hits, "GMAIL_GET_PROFILE");
    const executed = await session.execute(tool, {});
    const data = asRecord(executed);
    return {
      ok: data.successful !== false && !data.error,
      configured: true,
      toolkit: "gmail",
      tool,
      logId: extractLogId(data),
      excerpt: formatComposioResult(data).slice(0, 400),
      error: data.error ? String(data.error) : undefined,
      gmailConnected: true,
    };
  }

  const found = await session.search({
    query: "hacker news user profile by username",
    toolkits: ["hackernews"],
  });
  const hits = Array.isArray((found as { items?: unknown[] }).items)
    ? ((found as { items: Array<{ slug?: string; tool_slug?: string; name?: string }> }).items)
    : [];
  const tool = pickDiscoveredSlug(hits, "HACKERNEWS_GET_USER");
  const executed = await session.execute(tool, { username: "pg" });
  const data = asRecord(executed);
  const authorize = await session.authorize("gmail", {
    callbackUrl: composioCallbackUrl({
      workspaceId,
      pluginId: "composio-gmail",
      userId: "probe",
    }),
  });
  const connectUrl = redirectFromUnknown(authorize);
  return {
    ok: data.successful !== false && !data.error,
    configured: true,
    toolkit: "hackernews",
    tool,
    logId: extractLogId(data),
    excerpt: formatComposioResult(data).slice(0, 400),
    error: data.error ? String(data.error) : undefined,
    gmailConnected: false,
    connectHint: connectUrl
      ? "Gmail is not Connected. Open the Composio Connect Link from Marketplace → Gmail (Composio), then retry."
      : "Gmail is not Connected. Use Marketplace → Gmail (Composio) after COMPOSIO_API_KEY is set.",
  };
}
