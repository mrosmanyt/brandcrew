/**
 * MCP client — CINEM Pro as an MCP *client* (Package 8).
 *
 * Uses the official @modelcontextprotocol/sdk TypeScript SDK with the
 * Streamable HTTP client transport. Connections are short-lived: connect
 * (initialize handshake) → do the work → close. Nothing is cached as
 * "connected": a server only counts as Connected after a real
 * initialize + tools/list succeeds in that moment.
 *
 * Write gate (house rule, mirrors Composio): an MCP tool is a WRITE
 * unless its annotations explicitly set readOnlyHint: true. Unknown or
 * unannotated tools default to WRITE and must pause for approval —
 * an MCP server can never bypass the gate by omitting annotations.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

const CONNECT_TIMEOUT_MS = 15_000;
const CALL_TIMEOUT_MS = 30_000;

export type McpToolInfo = {
  name: string;
  description: string;
  /** True only when the server explicitly annotates readOnlyHint: true. */
  readOnly: boolean;
  /** The gate classification: anything not explicitly read-only is a write. */
  write: boolean;
};

export type McpConnection = {
  url: string;
  headers: Record<string, string>;
};

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s.`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function errorText(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "Unknown MCP error.");
  return raw.slice(0, 500);
}

async function withMcpSession<T>(
  connection: McpConnection,
  run: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ name: "cinem-pro", version: "1.0.0" }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(connection.url), {
    requestInit: { headers: connection.headers },
  });
  try {
    await withTimeout(client.connect(transport), CONNECT_TIMEOUT_MS, "MCP connect");
    return await run(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

function toToolInfo(tool: Tool): McpToolInfo {
  const readOnly = tool.annotations?.readOnlyHint === true;
  return {
    name: tool.name,
    description: String(tool.description || "").slice(0, 400),
    readOnly,
    write: !readOnly,
  };
}

/**
 * Real connection test: initialize + tools/list. Throws with the server's
 * own error when the endpoint is unreachable, rejects the handshake, or
 * demands auth we did not supply — the caller shows that error as-is.
 */
export async function listMcpTools(connection: McpConnection): Promise<McpToolInfo[]> {
  return withMcpSession(connection, async (client) => {
    const tools: McpToolInfo[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 3; page += 1) {
      const result = await withTimeout(
        client.listTools(cursor ? { cursor } : {}),
        CALL_TIMEOUT_MS,
        "MCP tools/list",
      );
      for (const tool of result.tools) tools.push(toToolInfo(tool));
      cursor = result.nextCursor;
      if (!cursor) break;
    }
    return tools;
  });
}

export type McpCallResult = {
  ok: boolean;
  /** Gate classification of the tool, re-read live from tools/list. */
  write: boolean;
  text: string;
  error: string | null;
};

function formatCallContent(content: unknown): string {
  if (!Array.isArray(content)) {
    return content == null ? "" : JSON.stringify(content).slice(0, 8000);
  }
  const parts: string[] = [];
  for (const block of content as Array<Record<string, unknown>>) {
    if (block && block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    } else if (block) {
      parts.push(JSON.stringify(block).slice(0, 2000));
    }
  }
  return parts.join("\n").slice(0, 8000);
}

/**
 * Call one tool on a server. The tool's write classification is re-read
 * from a live tools/list in the same session, so a caller can enforce
 * the approval gate on facts the server itself just reported — never on
 * a stale cache or a planner-supplied flag.
 */
export async function callMcpTool(input: {
  connection: McpConnection;
  toolName: string;
  arguments?: Record<string, unknown>;
}): Promise<McpCallResult> {
  try {
    return await withMcpSession(input.connection, async (client) => {
      const listed = await withTimeout(client.listTools({}), CALL_TIMEOUT_MS, "MCP tools/list");
      const tool = listed.tools.find((row) => row.name === input.toolName);
      if (!tool) {
        return {
          ok: false,
          write: true,
          text: "",
          error: `The MCP server no longer offers a tool named "${input.toolName}".`,
        };
      }
      const info = toToolInfo(tool);
      const result = (await withTimeout(
        client.callTool({ name: input.toolName, arguments: input.arguments || {} }),
        CALL_TIMEOUT_MS,
        "MCP tools/call",
      )) as { content?: unknown; isError?: boolean };
      const text = formatCallContent(result.content);
      if (result.isError) {
        return {
          ok: false,
          write: info.write,
          text,
          error: text || "The MCP tool reported an error.",
        };
      }
      return { ok: true, write: info.write, text, error: null };
    });
  } catch (error) {
    return { ok: false, write: true, text: "", error: errorText(error) };
  }
}

/** Classification helper shared by the planner note and the write gate. */
export function mcpToolIsWrite(tool: Pick<McpToolInfo, "write">): boolean {
  return tool.write;
}
