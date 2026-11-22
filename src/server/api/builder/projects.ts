import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { enforceSensitiveRateLimit } from "@/lib/rate-limit";
import {
  createSiteProject,
  getBuilderStatus,
  listSiteProjects,
} from "@/lib/site-builder";
import { isSiteTemplateId } from "@/lib/site-builder-pure";

const createSchema = z.object({
  title: z.string().trim().max(120).optional(),
  template: z
    .string()
    .trim()
    .max(40)
    .refine((value) => isSiteTemplateId(value), "Unknown template.")
    .nullable()
    .optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const [status, projects] = await Promise.all([
      getBuilderStatus(user.id),
      listSiteProjects(user.id),
    ]);
    return jsonOk({ status, projects });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await enforceSensitiveRateLimit(request, ["api", "builder", "projects"], "POST");
    const user = await requireUser();
    const body = createSchema.parse(await request.json().catch(() => ({})));
    const result = await createSiteProject({
      userId: user.id,
      userName: user.name,
      title: body.title,
      template: body.template ?? null,
    });
    return jsonOk(result, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Invalid website project payload."));
    }
    return jsonError(error);
  }
}
