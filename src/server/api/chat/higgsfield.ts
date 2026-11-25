import { requireUser } from "@/lib/auth";
import {
  HIGGSFIELD_CONSOLE_URL,
  HIGGSFIELD_DOCS_URL,
  HIGGSFIELD_MODELS,
  validateStoredHiggsfieldKey,
} from "@/lib/higgsfield";
import { jsonError, jsonOk } from "@/lib/http";
import { readByokSnapshot } from "@/lib/user-provider-keys";

/**
 * GET /api/chat/higgsfield — connector state for the signed-in user.
 * `configured` only means a key ID + secret are stored; it does NOT
 * claim the key works — POST runs the real check.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const snapshot = await readByokSnapshot(user.id);
    return jsonOk({
      configured: snapshot.hasHiggsfieldKey,
      models: HIGGSFIELD_MODELS,
      docsUrl: HIGGSFIELD_DOCS_URL,
      consoleUrl: HIGGSFIELD_CONSOLE_URL,
    });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * POST /api/chat/higgsfield — validate the stored key against the live
 * Higgsfield API (documented request-status endpoint; see lib note).
 */
export async function POST() {
  try {
    const user = await requireUser();
    const result = await validateStoredHiggsfieldKey(user.id);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
