/**
 * Client-side helper to send WhatsApp Cloud API replies when keys are in Assistant settings.
 * Server webhook path uses src/lib/whatsapp-cloud.ts instead.
 */
import { useSettingsStore } from "@/store/useSettingsStore";

export async function sendWhatsAppCloudReply(toPhoneE164: string, text: string): Promise<void> {
  const { whatsappToken, whatsappPhoneNumberId } = useSettingsStore.getState();
  const token = whatsappToken.trim();
  const phoneId = whatsappPhoneNumberId.trim();
  if (!token || !phoneId) return;

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
        to: toPhoneE164.replace(/^\+/, ""),
        type: "text",
        text: { body: chunk },
      }),
    }).catch(() => undefined);
  }
}
