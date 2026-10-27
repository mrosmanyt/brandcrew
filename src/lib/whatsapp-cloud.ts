/**
 * WhatsApp Cloud API — webhook verify + inbound message queue for desktop Assistant.
 * Sessions stay on the user's PC; this layer only routes text commands.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { enqueueAssistantRemoteCommand } from "@/lib/remote-command-queue";

export function whatsappCloudConfigured(): boolean {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const verify = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  return Boolean(token && phoneId && verify);
}

export function verifyWebhookToken(provided: string): boolean {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "";
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Normalize to +digits for consistent lookup. */
export function normalizeWhatsAppPhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? `+${digits}` : "";
}

export async function linkWhatsAppPhone(userId: string, phoneE164: string) {
  const phone = normalizeWhatsAppPhone(phoneE164);
  if (!phone || phone.length < 8) throw new Error("Invalid phone number.");
  return prisma.assistantWhatsAppLink.upsert({
    where: { userId },
    create: { userId, phoneE164: phone },
    update: { phoneE164: phone },
  });
}

export async function resolveUserByWhatsAppPhone(phone: string) {
  const phoneE164 = normalizeWhatsAppPhone(phone);
  return prisma.assistantWhatsAppLink.findUnique({
    where: { phoneE164 },
    select: { userId: true, phoneE164: true },
  });
}

type WaWebhookBody = {
  entry?: {
    changes?: {
      value?: {
        messages?: {
          from: string;
          id: string;
          type: string;
          text?: { body: string };
        }[];
        metadata?: { phone_number_id?: string };
      };
    }[];
  }[];
};

export async function handleWhatsAppWebhook(body: WaWebhookBody): Promise<{ queued: number }> {
  let queued = 0;
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      for (const msg of value?.messages ?? []) {
        if (msg.type !== "text" || !msg.text?.body?.trim()) continue;
        const link = await resolveUserByWhatsAppPhone(msg.from);
        if (!link) continue;
        await enqueueAssistantRemoteCommand({
          userId: link.userId,
          channel: "whatsapp_cloud",
          sourceId: link.phoneE164,
          text: msg.text.body.trim(),
        });
        queued += 1;
      }
    }
  }
  return { queued };
}

/** Server-side reply when desktop is offline (optional fallback). */
export async function sendWhatsAppCloudMessage(toPhoneE164: string, text: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneId) return;

  const to = toPhoneE164.replace(/^\+/, "");
  const chunks = text.match(/[\s\S]{1,3900}/g) ?? [text];
  for (const chunk of chunks) {
    await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: chunk },
      }),
    });
  }
}

export function hashAppSecret(payload: string, signatureHeader: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!secret) return true; // optional when app secret not set
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const digest = createHmac("sha256", secret).update(payload).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  try {
    return timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(provided, "hex"));
  } catch {
    return false;
  }
}
