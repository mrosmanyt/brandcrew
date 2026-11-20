import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { withNativeCors } from "@/lib/auth-native";
import { createOrGetShareToken, revokeShareToken } from "@/lib/image-share";
import { jsonError, jsonOk } from "@/lib/http";
import { enforceSensitiveRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  id: z.string().trim().min(1).max(128),
});

/**
 * POST /api/image/share { id } → { token, path }
 * Creates (or returns) the public share token for one of the caller's own
 * generated images. DELETE { id } revokes it. Owner-only in both cases.
 */
export async function POST(request: Request) {
  try {
    await enforceSensitiveRateLimit(request, ["api", "image", "share"], "POST");
    const user = await requireUser();
    const body = bodySchema.parse(await request.json());
    const token = await createOrGetShareToken(user.id, body.id);
    if (!token) {
      return NextResponse.json(
        { error: "That image could not be shared.", code: "not_found" },
        { status: 404 },
      );
    }
    return withNativeCors(jsonOk({ token, path: `/share/image/${token}` }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "An image id is required.", code: "invalid_request" },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await enforceSensitiveRateLimit(request, ["api", "image", "share"], "DELETE");
    const user = await requireUser();
    const body = bodySchema.parse(await request.json());
    const revoked = await revokeShareToken(user.id, body.id);
    if (!revoked) {
      return NextResponse.json(
        { error: "That image could not be found.", code: "not_found" },
        { status: 404 },
      );
    }
    return withNativeCors(jsonOk({ revoked: true }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "An image id is required.", code: "invalid_request" },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}
