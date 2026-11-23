import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { enforceSensitiveRateLimit } from "@/lib/rate-limit";
import {
  getSiteSettingsForUser,
  serializeSiteSettings,
  updateSiteSettings,
} from "@/lib/site-builder";

type Ctx = { params: Promise<{ projectId: string }> };

const patchSchema = z.object({
  whatsappNumber: z.string().trim().max(32).nullable().optional(),
  whatsappEnabled: z.boolean().optional(),
  language: z.enum(["en", "ur", "roman-ur", "mixed"]).optional(),
  products: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        price: z.string().trim().max(40),
        imageAssetId: z.string().max(64).optional(),
        note: z.string().trim().max(120).optional(),
      }),
    )
    .max(30)
    .optional(),
  metaTitle: z.string().trim().max(70).nullable().optional(),
  metaDescription: z.string().trim().max(200).nullable().optional(),
});

export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { projectId } = await context.params;
    return jsonOk({
      settings: await getSiteSettingsForUser(user.id, projectId),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    await enforceSensitiveRateLimit(
      request,
      ["api", "builder", "settings"],
      "PATCH",
    );
    const user = await requireUser();
    const { projectId } = await context.params;
    const body = patchSchema.parse(await request.json());
    const settings = await updateSiteSettings({
      userId: user.id,
      projectId,
      whatsappNumber: body.whatsappNumber,
      whatsappEnabled: body.whatsappEnabled,
      language: body.language,
      products: body.products,
      metaTitle: body.metaTitle,
      metaDescription: body.metaDescription,
    });
    return jsonOk({ settings: serializeSiteSettings(settings) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Invalid settings payload."));
    }
    return jsonError(error);
  }
}
