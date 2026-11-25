/**
 * MCP servers for the chat product (Package 8) — per-user, like chat
 * memory and chat settings (chat is user-scoped; desks are workspaces).
 *
 * Honesty rules: header values are stored encrypted and never returned
 * to the client (only header names). "Connected" is never stored — it
 * is proven live by testMcpServer (initialize + tools/list) every time.
 */
import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto-secret";
import { ClientError } from "@/lib/http";
import { callMcpTool, listMcpTools, type McpToolInfo } from "@/lib/mcp-client";

export type McpServerDTO = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  /** Names of the stored auth headers (values are never exposed). */
  headerNames: string[];
  createdAt: string;
  updatedAt: string;
};

export type McpDirectoryEntry = {
  id: string;
  name: string;
  description: string;
  url: string;
  /**
   * none: connects as-is. header: the add form collects one header value.
   * oauth: the vendor's sign-in happens in a browser OAuth flow this
   * header-based client cannot complete — listed honestly, no fake
   * one-click connect.
   */
  auth: "none" | "header" | "oauth";
  headerName?: string;
  headerHint?: string;
  headerOptional?: boolean;
  note: string;
};

/**
 * Curated directory of vendor-hosted remote MCP servers. Every URL is a
 * real public Streamable-HTTP endpoint run by the vendor (checked
 * against vendor docs, Nov 2026). OAuth-only servers are marked as such
 * instead of pretending a header form can sign the user in.
 */
export const MCP_DIRECTORY: McpDirectoryEntry[] = [
  {
    id: "microsoft-learn",
    name: "Microsoft Learn",
    description: "Search and read official Microsoft / Azure documentation.",
    url: "https://learn.microsoft.com/api/mcp",
    auth: "none",
    note: "No account or key needed — this one connects as-is.",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Repositories, issues, pull requests and Actions from GitHub's official hosted server.",
    url: "https://api.githubcopilot.com/mcp/",
    auth: "header",
    headerName: "Authorization",
    headerHint: "Bearer <your GitHub personal access token>",
    note: "Paste a GitHub personal access token. It is stored encrypted and sent only to GitHub.",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Stripe's official server: payments, customers, subscriptions and docs search.",
    url: "https://mcp.stripe.com",
    auth: "header",
    headerName: "Authorization",
    headerHint: "Bearer <restricted or Agent API key>",
    note: "Use a restricted or Agent API key — Stripe rejects full secret keys for MCP. Writes (charges, refunds) always pause for approval here.",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Linear's official server: issues, projects and comments.",
    url: "https://mcp.linear.app/mcp",
    auth: "header",
    headerName: "Authorization",
    headerHint: "Bearer <your Linear personal API key>",
    note: "Create a personal API key in Linear → Settings → API.",
  },
  {
    id: "context7",
    name: "Context7",
    description: "Current, version-specific documentation for libraries and frameworks (Upstash).",
    url: "https://mcp.context7.com/mcp",
    auth: "header",
    headerName: "CONTEXT7_API_KEY",
    headerHint: "Your Context7 API key (optional)",
    headerOptional: true,
    note: "Works without a key; a free Context7 API key raises the rate limits.",
  },
  {
    id: "higgsfield",
    name: "Higgsfield",
    description: "Higgsfield's own MCP server: image and video generation on your Higgsfield account.",
    url: "https://mcp.higgsfield.ai/mcp",
    auth: "oauth",
    note: "Sign-in happens in Higgsfield's own browser window (OAuth), which this header-based client cannot complete yet. For Higgsfield generation inside CINEM Pro, use the Higgsfield API key connector below instead.",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Notion's hosted MCP server: search, read and edit pages and databases.",
    url: "https://mcp.notion.com/mcp",
    auth: "oauth",
    note: "Notion's hosted server is OAuth-only, which this client cannot complete yet. For Notion today, connect Notion through Composio in the list above.",
  },
  {
    id: "sentry",
    name: "Sentry",
    description: "Sentry's official server: issues, events and traces.",
    url: "https://mcp.sentry.dev/mcp",
    auth: "oauth",
    note: "Sentry's hosted server is OAuth-only, which this header-based client cannot complete yet.",
  },
];

type McpServerRow = {
  id: string;
  userId: string;
  name: string;
  url: string;
  headersEnc: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function parseHeadersEnc(headersEnc: string): Record<string, string> {
  if (!headersEnc) return {};
  try {
    const parsed = JSON.parse(decryptSecret(headersEnc)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string" && value) headers[name] = value;
    }
    return headers;
  } catch {
    return {};
  }
}

function serializeServer(row: McpServerRow): McpServerDTO {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    enabled: row.enabled,
    headerNames: Object.keys(parseHeadersEnc(row.headersEnc)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function validateMcpServerUrl(raw: string): string {
  const url = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ClientError("That does not look like a valid URL.", 400);
  }
  const loopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(loopback && parsed.protocol === "http:")) {
    throw new ClientError("MCP server URLs must use https (http is allowed only for localhost).", 400);
  }
  if (parsed.username || parsed.password) {
    throw new ClientError("Put credentials in the header fields, not in the URL.", 400);
  }
  return parsed.toString();
}

function cleanHeaders(input: Record<string, string> | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(input || {})) {
    const trimmedName = name.trim();
    const trimmedValue = value.trim();
    if (!trimmedName || !trimmedValue) continue;
    if (!/^[A-Za-z0-9-]+$/.test(trimmedName)) {
      throw new ClientError(`"${trimmedName}" is not a valid header name.`, 400);
    }
    headers[trimmedName] = trimmedValue;
  }
  return headers;
}

export async function listMcpServers(userId: string): Promise<McpServerDTO[]> {
  const rows = await prisma.mcpServer.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(serializeServer);
}

export async function createMcpServer(
  userId: string,
  input: { name: string; url: string; headers?: Record<string, string> },
): Promise<McpServerDTO> {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new ClientError("Give the server a name.", 400);
  const url = validateMcpServerUrl(input.url);
  const headers = cleanHeaders(input.headers);
  const row = await prisma.mcpServer.create({
    data: {
      userId,
      name,
      url,
      headersEnc: Object.keys(headers).length ? encryptSecret(JSON.stringify(headers)) : "",
    },
  });
  return serializeServer(row);
}

async function findOwnedServer(userId: string, serverId: string): Promise<McpServerRow> {
  const row = await prisma.mcpServer.findFirst({ where: { id: serverId, userId } });
  if (!row) throw new ClientError("MCP server not found.", 404, "not_found");
  return row;
}

export async function updateMcpServer(
  userId: string,
  serverId: string,
  input: {
    name?: string;
    url?: string;
    enabled?: boolean;
    /** undefined = keep stored headers; null = clear; object = replace. */
    headers?: Record<string, string> | null;
  },
): Promise<McpServerDTO> {
  await findOwnedServer(userId, serverId);
  const data: {
    name?: string;
    url?: string;
    enabled?: boolean;
    headersEnc?: string;
  } = {};
  if (input.name !== undefined) {
    const name = input.name.trim().slice(0, 80);
    if (!name) throw new ClientError("Give the server a name.", 400);
    data.name = name;
  }
  if (input.url !== undefined) data.url = validateMcpServerUrl(input.url);
  if (input.enabled !== undefined) data.enabled = input.enabled;
  if (input.headers !== undefined) {
    const headers = input.headers === null ? {} : cleanHeaders(input.headers);
    data.headersEnc = Object.keys(headers).length
      ? encryptSecret(JSON.stringify(headers))
      : "";
  }
  const row = await prisma.mcpServer.update({ where: { id: serverId }, data });
  return serializeServer(row);
}

export async function deleteMcpServer(userId: string, serverId: string) {
  await findOwnedServer(userId, serverId);
  await prisma.mcpServer.delete({ where: { id: serverId } });
  return { deleted: true as const };
}

export type McpTestResult = {
  ok: boolean;
  error: string | null;
  tools: McpToolInfo[];
};

/** Real status check: initialize + tools/list against the live endpoint. */
export async function testMcpServer(userId: string, serverId: string): Promise<McpTestResult> {
  const row = await findOwnedServer(userId, serverId);
  try {
    const tools = await listMcpTools({
      url: row.url,
      headers: parseHeadersEnc(row.headersEnc),
    });
    return { ok: true, error: null, tools };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 500) : "The MCP server could not be reached.",
      tools: [],
    };
  }
}

export type McpAvailableTool = McpToolInfo & {
  serverId: string;
  serverName: string;
};

/**
 * Every tool the user's enabled MCP servers currently offer, proven by a
 * live tools/list per server. Servers that fail to answer are skipped —
 * their tools are not presented to the model as available.
 */
export async function getEnabledMcpTools(userId: string): Promise<McpAvailableTool[]> {
  const rows = await prisma.mcpServer.findMany({
    where: { userId, enabled: true },
    orderBy: { createdAt: "asc" },
  });
  const available: McpAvailableTool[] = [];
  for (const row of rows) {
    try {
      const tools = await listMcpTools({
        url: row.url,
        headers: parseHeadersEnc(row.headersEnc),
      });
      for (const tool of tools) {
        available.push({ ...tool, serverId: row.id, serverName: row.name });
      }
    } catch {
      // Unreachable server: its tools simply are not available this run.
    }
  }
  return available;
}

/**
 * Execute one MCP tool for a user. The write classification comes from a
 * live tools/list inside callMcpTool — callers MUST check `write` and
 * route through the approval gate before treating a write as done; the
 * job runtime pauses before calling this for writes (see job-runtime).
 */
export async function callMcpToolForUser(input: {
  userId: string;
  serverRef: string;
  toolName: string;
  arguments?: Record<string, unknown>;
}) {
  const rows = await prisma.mcpServer.findMany({
    where: { userId: input.userId, enabled: true },
  });
  const ref = input.serverRef.trim().toLowerCase();
  const row =
    rows.find((candidate) => candidate.id === input.serverRef) ??
    rows.find((candidate) => candidate.name.toLowerCase() === ref);
  if (!row) {
    return {
      ok: false as const,
      write: true,
      text: "",
      error: `No enabled MCP server matches "${input.serverRef}".`,
      serverName: "",
    };
  }
  const result = await callMcpTool({
    connection: { url: row.url, headers: parseHeadersEnc(row.headersEnc) },
    toolName: input.toolName,
    arguments: input.arguments,
  });
  return { ...result, serverName: row.name };
}

/** Classify a tool without executing it (live tools/list) — for the gate. */
export async function classifyMcpToolForUser(input: {
  userId: string;
  serverRef: string;
  toolName: string;
}): Promise<{ found: boolean; write: boolean; serverName: string }> {
  const tools = await getEnabledMcpTools(input.userId);
  const ref = input.serverRef.trim().toLowerCase();
  const match = tools.find(
    (tool) =>
      (tool.serverId === input.serverRef || tool.serverName.toLowerCase() === ref) &&
      tool.name === input.toolName,
  );
  if (!match) return { found: false, write: true, serverName: "" };
  return { found: true, write: match.write, serverName: match.serverName };
}

/**
 * Bridge for the desk job runtime: jobs are workspace-scoped, MCP servers
 * are user-scoped, so a job uses the workspace owner's servers.
 */
export async function resolveWorkspaceOwnerUserId(workspaceId: string): Promise<string | null> {
  const owner = await prisma.workspaceMember.findFirst({
    where: { workspaceId, role: "owner" },
    select: { userId: true },
  });
  if (owner) return owner.userId;
  const anyMember = await prisma.workspaceMember.findFirst({
    where: { workspaceId },
    select: { userId: true },
  });
  return anyMember?.userId ?? null;
}
