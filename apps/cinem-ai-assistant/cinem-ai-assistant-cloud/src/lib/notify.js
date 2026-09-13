import { config } from "../config.js";
import { log } from "./log.js";

/** Telegram par message bhejo (job done/fail notifications + bot replies). */
export async function sendTelegram(chatId, text) {
  if (!chatId) return;
  if (config.mock || !config.telegramToken) {
    log.info(`[mock-telegram → ${chatId}] ${text.slice(0, 120)}`);
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${config.telegramToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
  } catch (e) {
    log.warn("Telegram send failed:", e.message);
  }
}
