import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertAssistantProAccessForUser } from "@/lib/assistant-pro-access";
import { jsonError, jsonOk } from "@/lib/http";
import { linkWhatsAppPhone } from "@/lib/whatsapp-cloud";
import { withNativeCors } from "@/lib/auth-native";

const schema = z.object({
  phone: z.string().min(8).max(20),
});

/** Pair the signed-in user's WhatsApp number for Cloud API inbound routing. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await assertAssistantProAccessForUser(user.id);
    const body = schema.parse(await request.json());
    const row = await linkWhatsAppPhone(user.id, body.phone);
    return withNativeCors(
      jsonOk({
        ok: true,
        phoneE164: row.phoneE164,
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
