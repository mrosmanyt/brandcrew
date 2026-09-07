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

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string; pluginId: string }> },
) {
  try {
    const { workspaceId, pluginId } = await context.params;
    const { user } = await requireWorkspaceMember(workspaceId);
    const plugin = getMarketplacePlugin(pluginId);
    const marketplace = `${appOrigin()}/desk/${workspaceId}/marketplace?tab=plugins`;
    if (!plugin || plugin.auth !== "oauth") {
      return NextResponse.redirect(`${marketplace}&error=unknown_plugin`);
    }
    if (!oauthReady(plugin)) {
      return NextResponse.redirect(
        `${marketplace}&error=oauth_not_configured&plugin=${encodeURIComponent(plugin.id)}`,
      );
    }
    const state = await signOAuthState({
      workspaceId,
      pluginId: plugin.id,
      userId: user.id,
    });
    return NextResponse.redirect(oauthAuthorizeUrl(plugin, state));
  } catch (error) {
    return jsonError(error);
  }
}
