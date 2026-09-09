import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/auth";
import { appOrigin } from "@/lib/crypto-secret";
import { jsonError } from "@/lib/http";
import { getMarketplacePlugin } from "@/lib/marketplace";
import {
  oauthAuthorizeUrl,
  oauthReady,
  signOAuthState,
} from "@/lib/plugins";
import { pluginOAuthReturnPath } from "@/lib/setup-wizard";

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string; pluginId: string }> },
) {
  try {
    const { workspaceId, pluginId } = await context.params;
    const { user } = await requireWorkspaceMember(workspaceId);
    const plugin = getMarketplacePlugin(pluginId);
    const next = new URL(request.url).searchParams.get("next") || "";
    const fail = (error: string) =>
      NextResponse.redirect(
        `${appOrigin()}${pluginOAuthReturnPath({
          workspaceId,
          next,
          error,
          plugin: plugin?.id || pluginId,
        })}`,
      );
    if (!plugin || plugin.auth !== "oauth") {
      return fail("unknown_plugin");
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
    return jsonError(error);
  }
}
