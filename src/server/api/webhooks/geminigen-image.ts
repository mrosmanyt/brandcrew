import { NextResponse } from "next/server";
import { writeGeminiGenWebhookCache } from "@/lib/image-generation-providers/geminigen";
import { jsonOk } from "@/lib/http";

type WebhookPayload = {
  event_name?: string;
  data?: {
    uuid?: string;
    status?: number;
    media_url?: string;
    error_message?: string;
  };
  uuid?: string;
  status?: number;
  media_url?: string;
  error_message?: string;
};

function unwrapWebhook(body: WebhookPayload) {
  const data = body.data ?? body;
  return {
    uuid: data.uuid || "",
    status: data.status ?? 0,
    mediaUrl: data.media_url || "",
    errorMessage: data.error_message || "",
  };
}

/** GeminiGen async completion webhook (optional — polling is the primary path). */
export async function POST(request: Request) {
  try {
    const secret = process.env.GEMINIGEN_WEBHOOK_SECRET?.trim();
    if (secret) {
      const provided =
        request.headers.get("x-geminigen-webhook-secret") ||
        request.headers.get("x-webhook-secret") ||
        "";
      if (provided !== secret) {
        return NextResponse.json({ error: "Invalid webhook secret." }, { status: 401 });
      }
    }

    const body = (await request.json().catch(() => ({}))) as WebhookPayload;
    const job = unwrapWebhook(body);
    if (!job.uuid) {
      return NextResponse.json({ error: "Missing job uuid." }, { status: 400 });
    }

    await writeGeminiGenWebhookCache({
      uuid: job.uuid,
      mediaUrl: job.mediaUrl,
      status: job.status || (job.mediaUrl ? 2 : 1),
      errorMessage: job.errorMessage,
    });

    return jsonOk({ ok: true, uuid: job.uuid });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook handler failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
