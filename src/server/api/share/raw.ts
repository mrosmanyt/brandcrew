import { NextResponse } from "next/server";
import { getSharedImage } from "@/lib/image-share";

type Ctx = { params: Promise<{ token: string }> };

/**
 * GET /api/share/image/:token/raw — the public bytes behind a share page.
 * No auth: the share token is the capability. Serves the stored base64
 * payload with its real content type, or 302-redirects to the provider's
 * hosted media URL when the row has one. 404 for unknown/revoked tokens.
 */
export async function GET(_request: Request, context: Ctx) {
  const { token } = await context.params;
  const shared = await getSharedImage(token);
  if (!shared) {
    return NextResponse.json(
      { error: "Not found.", code: "not_found" },
      { status: 404 },
    );
  }
  if (shared.mediaUrl) {
    return NextResponse.redirect(shared.mediaUrl, 302);
  }
  if (!shared.imageData) {
    return NextResponse.json(
      { error: "Not found.", code: "not_found" },
      { status: 404 },
    );
  }
  const bytes = Buffer.from(shared.imageData, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": shared.mimeType,
      "Cache-Control": "public, max-age=3600",
      "Content-Length": String(bytes.length),
    },
  });
}
