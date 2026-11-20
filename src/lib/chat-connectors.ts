/**
 * Connectors for the chat product, on the existing Composio layer
 * (src/lib/composio.ts). One Composio user per workspace
 * (`cinem-ws-<workspaceId>`), OAuth via Composio Connect Links.
 *
 * Honesty rules (house pattern): no COMPOSIO_API_KEY → everything reads
 * disconnected with the setup hint; "Connected" is shown only when
 * Composio returns an ACTIVE connected account for this workspace.
 */
import {
  COMPOSIO_AGENCY_TOOLKITS,
  composioConfigured,
  composioMissingHint,
  executeComposioTool,
  formatComposioResult,
  getActiveComposioAccount,
  getComposioToolkit,
  isComposioActiveStatus,
  listComposioAccounts,
  startComposioLink,
} from "@/lib/composio";
import { ClientError } from "@/lib/http";

export type ConnectorStatusDTO = {
  slug: string;
  name: string;
  description: string;
  category: string;
  auth: string;
  letter: string;
  color: string;
  featured: boolean;
  connected: boolean;
  /** Raw Composio status of the best account found (e.g. ACTIVE), or null. */
  status: string | null;
};

export type ConnectorStatusesDTO = {
  configured: boolean;
  hint: string | null;
  /** Set when Composio could not be reached/listed — statuses are then unknown, not "disconnected". */
  error: string | null;
  connectors: ConnectorStatusDTO[];
};

function baseRow(slug: string): ConnectorStatusDTO | null {
  const toolkit = getComposioToolkit(slug);
  if (!toolkit) return null;
  return {
    slug: toolkit.slug,
    name: toolkit.name,
    description: toolkit.description,
    category: toolkit.category,
    auth: toolkit.auth,
    letter: toolkit.letter,
    color: toolkit.color,
    featured: toolkit.featured,
    connected: false,
    status: null,
  };
}

export async function getConnectorStatuses(
  workspaceId: string,
): Promise<ConnectorStatusesDTO> {
  const rows = COMPOSIO_AGENCY_TOOLKITS.map((toolkit) => baseRow(toolkit.slug)).filter(
    (row): row is ConnectorStatusDTO => Boolean(row),
  );
  // Featured first (Gmail, Google Calendar lead), catalog order otherwise.
  rows.sort((a, b) => Number(b.featured) - Number(a.featured));

  if (!composioConfigured()) {
    return { configured: false, hint: composioMissingHint(), error: null, connectors: rows };
  }
  const listed = await listComposioAccounts(workspaceId);
  if (!listed.ok) {
    return {
      configured: true,
      hint: null,
      error: listed.error || "Could not reach Composio to read connection status.",
      connectors: rows,
    };
  }
  for (const row of rows) {
    const accounts = listed.accounts.filter((account) => account.toolkit === row.slug);
    const active = accounts.find((account) => isComposioActiveStatus(account.status));
    const best = active ?? accounts[0];
    row.connected = Boolean(active);
    row.status = best?.status ?? null;
  }
  return { configured: true, hint: null, error: null, connectors: rows };
}

/** Start the OAuth Connect Link flow for one toolkit. */
export async function startConnector(input: {
  workspaceId: string;
  userId: string;
  slug: string;
}) {
  const toolkit = getComposioToolkit(input.slug);
  if (!toolkit) throw new ClientError("Unknown connector.", 400);
  if (toolkit.auth !== "oauth") {
    throw new ClientError(
      `${toolkit.name} connects with an API key, not OAuth — it is not part of this connect flow yet.`,
      400,
    );
  }
  return startComposioLink({
    workspaceId: input.workspaceId,
    pluginId: toolkit.id,
    userId: input.userId,
  });
}

/**
 * Prove a connected toolkit end to end: run its read-only probe tool
 * (Gmail profile / Calendar list) and return a short result preview.
 */
export async function runConnectorProbe(input: {
  workspaceId: string;
  slug: string;
}) {
  const toolkit = getComposioToolkit(input.slug);
  if (!toolkit) throw new ClientError("Unknown connector.", 400);
  if (!composioConfigured()) {
    return { ok: false as const, error: composioMissingHint(), preview: null as string | null };
  }
  const active = await getActiveComposioAccount(input.workspaceId, toolkit.slug);
  if (!active.ok) {
    return { ok: false as const, error: active.error || "Could not read the connection.", preview: null };
  }
  if (!active.account) {
    return {
      ok: false as const,
      error: `${toolkit.name} is not connected yet. Connect it first, then run the test read.`,
      preview: null,
    };
  }
  const result = await executeComposioTool({
    workspaceId: input.workspaceId,
    toolkitSlug: toolkit.slug,
    toolSlug: toolkit.probeTool,
    connectedAccountId: active.account.id,
  });
  if (!result.ok) {
    return { ok: false as const, error: result.error || "The test read failed.", preview: null };
  }
  return {
    ok: true as const,
    error: null as string | null,
    preview: formatComposioResult(result.data).slice(0, 2000),
  };
}
