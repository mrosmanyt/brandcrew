import { connection, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/auth";
import { appOrigin } from "@/lib/crypto-secret";
import { ClientError } from "@/lib/http";
import { composioConfigured, startComposioLink } from "@/lib/composio";
import { getMarketplacePlugin } from "@/lib/marketplace";
import {
  oauthAuthorizeUrl,
  oauthReady,
  persistComposioConnection,
  signOAuthState,
} from "@/lib/plugins";
import { pluginOAuthReturnPath } from "@/lib/setup-wizard";

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string; pluginId: string }> },
) {
  await connection();
  const { workspaceId, pluginId } = await context.params;
  const next = new URL(request.url).searchParams.get("next") || "";
  const plugin = getMarketplacePlugin(pluginId);
  const fail = (error: string) =>
    NextResponse.redirect(
      `${appOrigin()}${pluginOAuthReturnPath({
        workspaceId,
        next,
        error,
        plugin: plugin?.id || pluginId,
      })}`,
    );

  try {
    const { user } = await requireWorkspaceMember(workspaceId);
    if (!plugin || (plugin.auth !== "oauth" && plugin.auth !== "composio")) {
      return fail("unknown_plugin");
    }
    if (plugin.auth === "composio") {
      if (!composioConfigured()) return fail("composio_not_configured");
      const started = await startComposioLink({
        workspaceId,
        pluginId: plugin.id,
        userId: user.id,
      });
      if (started.connectionId && !started.redirectUrl) {
        await persistComposioConnection({
          workspaceId,
          plugin,
          accountId: started.connectionId,
        });
        return NextResponse.redirect(
          `${appOrigin()}${pluginOAuthReturnPath({
            workspaceId,
            next,
            connected: plugin.id,
            plugin: plugin.id,
          })}`,
        );
      }
      if (!started.redirectUrl) return fail("composio_no_redirect");
      return NextResponse.redirect(started.redirectUrl);
    }
    if (!oauthReady(plugin)) {
      return fail("oauth_not_configured");
    }
    const state = await signOAuthState({
      workspaceId,
      pluginId: plugin.id,
      userId: user.id,
      next,
    });
    return NextResponse.redirect(oauthAuthorizeUrl(plugin, state));
  } catch (error) {
    if (plugin?.auth === "composio") {
      if (!composioConfigured()) return fail("composio_not_configured");
      if (error instanceof ClientError && /Connect Link/i.test(error.message)) {
        return fail("composio_no_redirect");
      }
      return fail("composio_failed");
    }
    return fail("oauth_failed");
  }
}
