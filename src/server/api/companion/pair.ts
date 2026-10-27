import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { planForUser } from "@/lib/cinem-ai-assistant-usage";
import {
  activeCompanionPair,
  claimCompanionPair,
  createCompanionPair,
} from "@/lib/mobile-companion";
import { withNativeCors } from "@/lib/auth-native";

/** Active pairing session for the signed-in user. */
export async function GET() {
  try {
    const user = await requireUser();
    const pair = await activeCompanionPair(user.id);
    return withNativeCors(
      jsonOk({
        paired: Boolean(pair && pair.status === "active"),
        pair: pair
          ? {
              id: pair.id,
              pairCode: pair.pairCode,
              workspaceId: pair.workspaceId,
              status: pair.status,
              expiresAt: pair.expiresAt.toISOString(),
              claimedAt: pair.claimedAt?.toISOString() ?? null,
            }
          : null,
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}

const createSchema = z.object({
  workspaceId: z.string().min(1).max(80).optional(),
});

/** Generate a new pair code + command token (desktop assistant). */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = createSchema.parse(await request.json().catch(() => ({})));
    const entitlement = await planForUser(user.id);
    const workspaceId = body.workspaceId || entitlement.workspaceId;
    if (!workspaceId) {
      return withNativeCors(jsonOk({ error: "No desk workspace found for this account." }, 400));
    }
    const pair = await createCompanionPair({ userId: user.id, workspaceId });
    return withNativeCors(jsonOk(pair));
  } catch (error) {
    return jsonError(error);
  }
}

const claimSchema = z.object({
  pairCode: z.string().min(4).max(12),
});

/** Phone / mobile web claims a pair code (same account). */
export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const body = claimSchema.parse(await request.json());
    const result = await claimCompanionPair({ userId: user.id, pairCode: body.pairCode });
    if (!result.ok) {
      return withNativeCors(jsonOk({ error: result.error }, 400));
    }
    return withNativeCors(
      jsonOk({
        ok: true,
        workspaceId: result.pair.workspaceId,
        status: result.pair.status,
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
