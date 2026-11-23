import { getSiteAssetRaw } from "@/lib/site-builder";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ assetId: string }> };

/**
 * Public raw serving for uploaded site photos/logos (Package C).
 * Asset ids are unguessable cuids — the same pattern as image share
 * tokens — so a published site (and the builder preview) can load the
 * image without a session. Content never changes for an id.
 */
export async function GET(_request: Request, context: Ctx) {
  const { assetId } = await context.params;
  const asset = await getSiteAssetRaw(assetId);
  if (!asset) {
    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const bytes = Buffer.from(asset.dataBase64, "base64");
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
