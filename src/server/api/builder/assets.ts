import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { enforceSensitiveRateLimit } from "@/lib/rate-limit";
import {
  deleteSiteAsset,
  listSiteAssetsSafe,
  serializeSiteAsset,
  uploadSiteAsset,
} from "@/lib/site-builder";

type ProjectCtx = { params: Promise<{ projectId: string }> };
type AssetCtx = { params: Promise<{ assetId: string }> };

const uploadSchema = z.object({
  name: z.string().trim().max(120).optional(),
  mimeType: z.string().trim().max(60),
  // 3.5 MB of image ≈ 4.7M base64 chars; the service re-checks the
  // decoded size against the real cap.
  dataBase64: z.string().min(16).max(4_900_000),
});

export async function GET(_request: Request, context: ProjectCtx) {
  try {
    const user = await requireUser();
    const { projectId } = await context.params;
    const rows = await listSiteAssetsSafe(projectId);
    return jsonOk({
      assets: rows
        .filter((row) => row.userId === user.id)
        .map(serializeSiteAsset),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: ProjectCtx) {
  try {
    await enforceSensitiveRateLimit(
      request,
      ["api", "builder", "assets"],
      "POST",
    );
    const user = await requireUser();
    const { projectId } = await context.params;
    const body = uploadSchema.parse(await request.json());
    const asset = await uploadSiteAsset({
      userId: user.id,
      projectId,
      name: body.name ?? "Photo",
      mimeType: body.mimeType,
      dataBase64: body.dataBase64,
    });
    return jsonOk({ asset }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(
        new Error("That upload could not be read. Try a smaller image."),
      );
    }
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: AssetCtx) {
  try {
    const user = await requireUser();
    const { assetId } = await context.params;
    return jsonOk(await deleteSiteAsset({ userId: user.id, assetId }));
  } catch (error) {
    return jsonError(error);
  }
}
