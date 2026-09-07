import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { encryptSecret, decryptSecret, appOrigin } from "@/lib/crypto-secret";
import { ClientError } from "@/lib/http";
import {
  envValuePresent,
  firstEnvValue,
  getMarketplacePlugin,
  MARKETPLACE_PLUGINS,
  resolveApiKeyConnect,
  type PluginDef,
} from "@/lib/marketplace";

export type PluginConnectionDTO = {
  pluginId: string;
  status: "connected" | "disconnected";
  connected: boolean;
  metadata: Record<string, unknown>;
  tools: string[];
  auth: PluginDef["auth"];
  oauthReady: boolean;
  envReady: boolean;
  missingEnv: string[];
  setupHint: string;
};

function sessionBytes() {
  const raw =
    process.env.SESSION_SECRET || "brandcrew-dev-session-secret-change-me";
  return new TextEncoder().encode(raw);
}

export function googleClient(plugin: PluginDef) {
  if (plugin.id === "gmail") {
    return {
      id: process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "",
      secret:
        process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
    };
  }
  return {
    id: process.env.GOOGLE_CLIENT_ID || "",
    secret: process.env.GOOGLE_CLIENT_SECRET || "",
  };
}

export function oauthClient(plugin: PluginDef): { id: string; secret: string } {
  if (plugin.oauthProvider === "google") return googleClient(plugin);
  if (plugin.oauthProvider === "slack") {
    return {
      id: process.env.SLACK_CLIENT_ID || "",
      secret: process.env.SLACK_CLIENT_SECRET || "",
    };
  }
  if (plugin.oauthProvider === "notion") {
    return {
      id: process.env.NOTION_CLIENT_ID || "",
      secret: process.env.NOTION_CLIENT_SECRET || "",
    };
  }
  return { id: "", secret: "" };
}

export function oauthMissingEnv(plugin: PluginDef) {
  if (plugin.auth !== "oauth") return [];
  const client = oauthClient(plugin);
  const missing: string[] = [];
  if (plugin.oauthProvider === "google") {
    if (plugin.id === "gmail") {
      if (!client.id) missing.push("GMAIL_CLIENT_ID or GOOGLE_CLIENT_ID");
      if (!client.secret) missing.push("GMAIL_CLIENT_SECRET or GOOGLE_CLIENT_SECRET");
    } else {
      if (!client.id) missing.push("GOOGLE_CLIENT_ID");
      if (!client.secret) missing.push("GOOGLE_CLIENT_SECRET");
    }
  } else if (plugin.oauthProvider === "slack") {
    if (!client.id) missing.push("SLACK_CLIENT_ID");
    if (!client.secret) missing.push("SLACK_CLIENT_SECRET");
  } else if (plugin.oauthProvider === "notion") {
    if (!client.id) missing.push("NOTION_CLIENT_ID");
    if (!client.secret) missing.push("NOTION_CLIENT_SECRET");
  }
  return missing;
}

export function oauthReady(plugin: PluginDef) {
  const client = oauthClient(plugin);
  return Boolean(client.id.trim() && client.secret.trim());
}

export function setupHint(plugin: PluginDef) {
  if (plugin.auth === "api_key") {
    if (envValuePresent(plugin.envKeys)) {
      return `${plugin.envKeys[0]} is set on the server. You can Connect with that, or paste a workspace key.`;
    }
    return `Paste a ${plugin.secretLabel || "key"} or set ${plugin.envKeys.join(" / ")} on the server. Empty Connect stays disconnected.`;
  }
  const missing = oauthMissingEnv(plugin);
  if (missing.length) {
    return `OAuth is not configured. Set ${missing.join(" and ")}. Connect stays disconnected until a real callback succeeds.`;
  }
  return "OAuth client is configured. Connect opens the provider — Connected only after a successful callback.";
}

export function publicPluginMetadata(raw: string) {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (/secret|token|key|password/i.test(key)) continue;
      out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializePluginConnection(
  plugin: PluginDef,
  row?: { pluginId: string; status: string; metadata: string } | null,
): PluginConnectionDTO {
  const connected = row?.status === "connected";
  return {
    pluginId: plugin.id,
    status: connected ? "connected" : "disconnected",
    connected,
    metadata: row ? publicPluginMetadata(row.metadata) : {},
    tools: plugin.tools,
    auth: plugin.auth,
    oauthReady: plugin.auth === "oauth" ? oauthReady(plugin) : false,
    envReady: envValuePresent(plugin.envKeys),
    missingEnv: plugin.auth === "oauth" ? oauthMissingEnv(plugin) : [],
    setupHint: setupHint(plugin),
  };
}

export async function listPluginConnections(workspaceId: string) {
  const rows = await prisma.pluginConnection.findMany({ where: { workspaceId } });
  const byId = new Map(rows.map((row) => [row.pluginId, row]));
  return MARKETPLACE_PLUGINS.map((plugin) =>
    serializePluginConnection(plugin, byId.get(plugin.id) ?? null),
  );
}

export async function connectApiKeyPlugin(input: {
  workspaceId: string;
  pluginId: string;
  apiKey?: string;
  useEnv?: boolean;
}) {
  const plugin = getMarketplacePlugin(input.pluginId);
  if (!plugin) throw new Error("Unknown plugin.");
  const resolved = resolveApiKeyConnect(plugin, {
    apiKey: input.apiKey,
    useEnv: input.useEnv,
  });
  if (!resolved.ok) {
    throw new ClientError(resolved.error);
  }
  const metadata = {
    source: resolved.source,
    connectedAt: new Date().toISOString(),
  };
  const row = await prisma.pluginConnection.upsert({
    where: {
      workspaceId_pluginId: {
        workspaceId: input.workspaceId,
        pluginId: plugin.id,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      pluginId: plugin.id,
      status: "connected",
      metadata: JSON.stringify(metadata),
      secretEnc: resolved.secret ? encryptSecret(resolved.secret) : "",
    },
    update: {
      status: "connected",
      metadata: JSON.stringify(metadata),
      secretEnc: resolved.secret ? encryptSecret(resolved.secret) : "",
    },
  });
  return serializePluginConnection(plugin, row);
}

export async function disconnectPlugin(workspaceId: string, pluginId: string) {
  const plugin = getMarketplacePlugin(pluginId);
  if (!plugin) throw new Error("Unknown plugin.");
  const row = await prisma.pluginConnection.upsert({
    where: {
      workspaceId_pluginId: { workspaceId, pluginId },
    },
    create: {
      workspaceId,
      pluginId,
      status: "disconnected",
      metadata: "{}",
      secretEnc: "",
    },
    update: {
      status: "disconnected",
      metadata: "{}",
      secretEnc: "",
    },
  });
  return serializePluginConnection(plugin, row);
}

export async function getConnectedPlugin(workspaceId: string, pluginId: string) {
  const row = await prisma.pluginConnection.findUnique({
    where: { workspaceId_pluginId: { workspaceId, pluginId } },
  });
  if (!row || row.status !== "connected") return null;
  const plugin = getMarketplacePlugin(pluginId);
  if (!plugin) return null;
  let secret = "";
  if (row.secretEnc) {
    try {
      secret = decryptSecret(row.secretEnc);
    } catch {
      secret = "";
    }
  }
  const metadata = publicPluginMetadata(row.metadata);
  if (!secret && metadata.source === "env") {
    secret = firstEnvValue(plugin.envKeys);
  }
  if (!secret) return null;
  return { plugin, secret, metadata };
}

export async function connectedToolNames(workspaceId: string) {
  const rows = await prisma.pluginConnection.findMany({
    where: { workspaceId, status: "connected" },
  });
  const tools = new Set<string>();
  for (const row of rows) {
    const plugin = getMarketplacePlugin(row.pluginId);
    for (const tool of plugin?.tools ?? []) tools.add(tool);
  }
  return [...tools];
}

export async function signOAuthState(input: {
  workspaceId: string;
  pluginId: string;
  userId: string;
}) {
  return new SignJWT({
    workspaceId: input.workspaceId,
    pluginId: input.pluginId,
    userId: input.userId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(sessionBytes());
}

export async function readOAuthState(token: string) {
  const { payload } = await jwtVerify(token, sessionBytes());
  const workspaceId = String(payload.workspaceId || "");
  const pluginId = String(payload.pluginId || "");
  const userId = String(payload.userId || "");
  if (!workspaceId || !pluginId || !userId) throw new Error("Invalid OAuth state.");
  return { workspaceId, pluginId, userId };
}

export function oauthRedirectUri() {
  return `${appOrigin()}/api/oauth/callback`;
}

export function oauthAuthorizeUrl(plugin: PluginDef, state: string) {
  const client = oauthClient(plugin);
  const redirect = oauthRedirectUri();
  if (plugin.oauthProvider === "google") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", client.id);
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", (plugin.scopes || []).join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", state);
    return url.toString();
  }
  if (plugin.oauthProvider === "slack") {
    const url = new URL("https://slack.com/oauth/v2/authorize");
    url.searchParams.set("client_id", client.id);
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("user_scope", "");
    url.searchParams.set("scope", (plugin.scopes || []).join(","));
    url.searchParams.set("state", state);
    return url.toString();
  }
  if (plugin.oauthProvider === "notion") {
    const url = new URL("https://api.notion.com/v1/oauth/authorize");
    url.searchParams.set("client_id", client.id);
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("owner", "user");
    url.searchParams.set("state", state);
    return url.toString();
  }
  throw new Error("Unknown OAuth provider.");
}

export async function exchangeOAuthCode(plugin: PluginDef, code: string) {
  const client = oauthClient(plugin);
  const redirect = oauthRedirectUri();
  if (plugin.oauthProvider === "google") {
    const body = new URLSearchParams({
      code,
      client_id: client.id,
      client_secret: client.secret,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok || !data.access_token) {
      throw new Error(String(data.error_description || data.error || "Google OAuth failed."));
    }
    let account = "";
    try {
      const me = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (me.ok) {
        const profile = (await me.json()) as { email?: string };
        account = profile.email || "";
      }
    } catch {
      account = "";
    }
    return {
      tokens: {
        accessToken: String(data.access_token),
        refreshToken: String(data.refresh_token || ""),
        tokenType: String(data.token_type || "Bearer"),
        expiresAt: Date.now() + Number(data.expires_in || 0) * 1000,
      },
      metadata: {
        source: "oauth",
        provider: "google",
        account,
        connectedAt: new Date().toISOString(),
      },
    };
  }
  if (plugin.oauthProvider === "slack") {
    const body = new URLSearchParams({
      code,
      client_id: client.id,
      client_secret: client.secret,
      redirect_uri: redirect,
    });
    const res = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      access_token?: string;
      team?: { name?: string; id?: string };
      authed_user?: { id?: string };
    };
    if (!data.ok || !data.access_token) {
      throw new Error(data.error || "Slack OAuth failed.");
    }
    return {
      tokens: {
        accessToken: data.access_token,
        teamId: data.team?.id || "",
        userId: data.authed_user?.id || "",
      },
      metadata: {
        source: "oauth",
        provider: "slack",
        teamName: data.team?.name || "",
        connectedAt: new Date().toISOString(),
      },
    };
  }
  if (plugin.oauthProvider === "notion") {
    const basic = Buffer.from(`${client.id}:${client.secret}`).toString("base64");
    const res = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirect,
      }),
    });
    const data = (await res.json()) as {
      access_token?: string;
      error?: string;
      workspace_name?: string;
      workspace_id?: string;
    };
    if (!res.ok || !data.access_token) {
      throw new Error(data.error || "Notion OAuth failed.");
    }
    return {
      tokens: { accessToken: data.access_token, workspaceId: data.workspace_id || "" },
      metadata: {
        source: "oauth",
        provider: "notion",
        workspaceName: data.workspace_name || "",
        connectedAt: new Date().toISOString(),
      },
    };
  }
  throw new Error("Unknown OAuth provider.");
}

export async function persistOAuthConnection(input: {
  workspaceId: string;
  plugin: PluginDef;
  tokens: Record<string, unknown>;
  metadata: Record<string, unknown>;
}) {
  const row = await prisma.pluginConnection.upsert({
    where: {
      workspaceId_pluginId: {
        workspaceId: input.workspaceId,
        pluginId: input.plugin.id,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      pluginId: input.plugin.id,
      status: "connected",
      metadata: JSON.stringify(input.metadata),
      secretEnc: encryptSecret(JSON.stringify(input.tokens)),
    },
    update: {
      status: "connected",
      metadata: JSON.stringify(input.metadata),
      secretEnc: encryptSecret(JSON.stringify(input.tokens)),
    },
  });
  return serializePluginConnection(input.plugin, row);
}
