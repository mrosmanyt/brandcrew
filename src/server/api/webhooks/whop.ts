import { NextResponse } from "next/server";
import { unwrapWebhook, WebhookVerificationError } from "@whop/sdk/helpers";
import { fulfillWhopEvent } from "@/lib/billing-fulfill";
import { jsonError } from "@/lib/http";

function headerMap(request: Request) {
  return Object.fromEntries(request.headers.entries());
}

export async function POST(request: Request) {
  const secret = process.env.WHOP_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "WHOP_WEBHOOK_SECRET is not configured.", code: "misconfigured" },
      { status: 500 },
    );
  }

  const payload = await request.text();
  const headers = headerMap(request);

  let body: Record<string, unknown>;
  try {
    body = unwrapWebhook<Record<string, unknown>>(payload, {
      headers,
      key: secret,
    });
  } catch (error) {
    if (error instanceof WebhookVerificationError || error instanceof Error) {
      return NextResponse.json(
        { error: "Invalid Whop webhook signature.", code: "unauthorized" },
        { status: 401 },
      );
    }
    return jsonError(error);
  }

  const webhookId =
    headers["webhook-id"] ||
    headers["Webhook-Id"] ||
    (typeof body.id === "string" ? body.id : "");

  try {
    const result = await fulfillWhopEvent({ webhookId, body });
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}
