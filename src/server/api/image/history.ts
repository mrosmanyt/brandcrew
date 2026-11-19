import { requireUser } from "@/lib/auth";
import { withNativeCors } from "@/lib/auth-native";
import { listImageGenHistoryForUser } from "@/lib/image-generation";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();
    const items = await listImageGenHistoryForUser(user.id);
    return withNativeCors(jsonOk({ items }));
  } catch (error) {
    return jsonError(error);
  }
}
