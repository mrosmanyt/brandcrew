import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { appOrigin } from "@/lib/crypto-secret";
import { fetchComposioAccount, isComposioActiveStatus } from "@/lib/composio";
import { getMarketplacePlugin } from "@/lib/marketplace";
import { persistComposioConnection } from "@/lib/plugins";
import { pluginOAuthReturnPath } from "@/lib/setup-wizard";

/**
 * Composio hosted-auth callback. Connected only when Composio reports ACTIVE.
 * Query: status, connected_account_id, workspaceId, pluginId, userId.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = (url.searchParams.get("status") || "").toLowerCase();
  const accountId =
    url.searchParams.get("connected_account_id") ||
    url.searchParams.get("connectedAccountId") ||
    "";
  const workspaceId = url.searchParams.get("workspaceId") || "";
  const pluginId = url.searchParams.get("pluginId") || "";
  const userId = url.searchParams.get("userId") || "";
  const origin = appOrigin();
  const bounce = (error?: string, connected?: string) =>
    NextResponse.redirect(
      `${origin}${pluginOAuthReturnPath({
        workspaceId: workspaceId || "missing",
        error,
        connected,
        plugin: pluginId,
      })}`,
    );

  if (!workspaceId || !pluginId) {
    return bounce("unknown_plugin");
  }
  if (status && status !== "success") {
    return bounce(status === "failed" ? "composio_failed" : status);
  }
  if (!accountId) {
    return bounce("composio_missing_account");
  }

  try {
    const plugin = getMarketplacePlugin(pluginId);
    if (!plugin || plugin.auth !== "composio") {
      return bounce("unknown_plugin");
    }
    if (userId) {
      const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
      });
      if (!member) return bounce("forbidden");
    }
    const fetched = await fetchComposioAccount(accountId);
    if (!fetched.ok || !isComposioActiveStatus(fetched.account.status)) {
      return bounce("composio_not_active");
    }
    await persistComposioConnection({
      workspaceId,
      plugin,
      accountId: fetched.account.id,
      metadata: { status: fetched.account.status, toolkit: fetched.account.toolkit },
    });
    return bounce(undefined, plugin.id);
  } catch {
    return bounce("composio_failed");
  }
}
