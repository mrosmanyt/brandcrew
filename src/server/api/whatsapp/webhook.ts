import { jsonError, jsonOk } from "@/lib/http";
import {
  handleWhatsAppWebhook,
  hashAppSecret,
  verifyWebhookToken,
  whatsappCloudConfigured,
} from "@/lib/whatsapp-cloud";

/** Meta webhook verification (GET). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";

  if (mode === "subscribe" && verifyWebhookToken(token)) {
    return new Response(challenge, { status: 200 });
  }
  return jsonOk({ error: "Verification failed." }, 403);
}

/** Inbound WhatsApp messages (POST) → queue for desktop Assistant. */
export async function POST(request: Request) {
  try {
    if (!whatsappCloudConfigured()) {
      return jsonOk({ error: "WhatsApp Cloud API is not configured on this deployment." }, 503);
    }
    const raw = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    if (!hashAppSecret(raw, signature)) {
      return jsonOk({ error: "Invalid signature." }, 401);
    }
    const body = JSON.parse(raw) as Record<string, unknown>;
    const result = await handleWhatsAppWebhook(body as Parameters<typeof handleWhatsAppWebhook>[0]);
    return jsonOk({ ok: true, queued: result.queued });
  } catch (error) {
    return jsonError(error);
  }
}
