import { NextResponse } from "next/server";

/**
 * GET /api/composio/callback — where Composio sends the browser back
 * after an OAuth connect (see composioCallbackUrl in src/lib/composio.ts).
 * Nothing is trusted from the query string: this simply lands the user on
 * the connectors page, which re-reads the real status from Composio.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const pluginId = url.searchParams.get("pluginId") || "";
  const slug = pluginId.replace(/^composio-/, "");
  const target = new URL("/connectors", url.origin);
  if (slug) target.searchParams.set("connected", slug);
  return NextResponse.redirect(target);
}
