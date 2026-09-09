import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { appOrigin } from "@/lib/crypto-secret";
import { getMarketplacePlugin } from "@/lib/marketplace";
import {
  exchangeOAuthCode,
  persistOAuthConnection,
  readOAuthState,
} from "@/lib/plugins";
import { pluginOAuthReturnPath } from "@/lib/setup-wizard";

/** Marketplace plugin OAuth only. User Google sign-in is `/api/auth/google/callback`. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const providerError = url.searchParams.get("error") || "";

  let workspaceId = "";
  let next = "";
  try {
    if (!state) throw new Error("Missing OAuth state.");
    const parsed = await readOAuthState(state);
    workspaceId = parsed.workspaceId;
    next = parsed.next;
    const origin = appOrigin();
    const bounce = (error?: string, connected?: string) =>
      NextResponse.redirect(
        `${origin}${pluginOAuthReturnPath({
          workspaceId,
          next,
          error,
          connected,
          plugin: parsed.pluginId,
        })}`,
      );
    if (providerError) {
      return bounce(providerError);
    }
    if (!code) {
      return bounce("missing_code");
    }
    const plugin = getMarketplacePlugin(parsed.pluginId);
    if (!plugin || plugin.auth !== "oauth") {
      return bounce("unknown_plugin");
    }
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: parsed.userId },
      },
    });
    if (!member) {
      return bounce("forbidden");
    }
    const exchanged = await exchangeOAuthCode(plugin, code);
    await persistOAuthConnection({
      workspaceId,
      plugin,
      tokens: exchanged.tokens,
      metadata: exchanged.metadata,
    });
    return bounce(undefined, plugin.id);
  } catch {
    const fallback = workspaceId
      ? `${appOrigin()}${pluginOAuthReturnPath({
          workspaceId,
          next,
          error: "oauth_failed",
        })}`
      : `${appOrigin()}/desk`;
    return NextResponse.redirect(fallback);
  }
}
