/**
 * TELEGRAM REMOTE CONTROL — control Cinem AI Assistant from your phone.
 *
 * How it works
 *   1. User creates a bot with @BotFather and pastes the token in
 *      Settings → Integrations.
 *   2. Cinem AI Assistant long-polls api.telegram.org getUpdates (25s) — no webhook,
 *      no public IP needed; works behind any NAT.
 *   3. SECURITY — first run shows a 6-digit pairing code in the app.
 *      Only the Telegram chat that sends that exact code gets linked
 *      (chat id persisted). Every other chat is refused forever.
 *   4. Each message from the linked chat = a Cinem AI Assistant command. It runs
 *      through the full orchestrator (same pipeline as voice/chat) and
 *      the reply is sent back to the same chat.
 *
 * Examples from your phone: "open google" · "morning briefing" ·
 * "research AI news" · "post to instagram with caption 'Hello'" ·
 * "remember that my flight is on Sunday".
 */
import { useIntegrationsStore } from "@/store/useIntegrationsStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { notify } from "@/store/useToastStore";
import { isRemoteControlEnabled } from "@/lib/remote-control/feature";
import { generatePairCode, isAuthorizedTelegramChat, isFreshMessage } from "@/lib/remote-control/pairing";
import { parseRemoteCommand } from "@/lib/remote-control/command-parser";
import { executeRemoteText } from "@/lib/remote-control/queue";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/* ── Telegram Bot API types (minimal) ─────────────────────────────── */
interface TgUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; first_name?: string; username?: string };
    text?: string;
    date: number;
  };
}

/* ── Module state ─────────────────────────────────────────────────── */
let running = false;
let abort: AbortController | null = null;
let offset = 0; // getUpdates offset (acknowledges processed updates)
let pairCode = "";
let startedAt = 0; // unix seconds — ignore messages sent before start

const setTg = (p: Parameters<ReturnType<typeof useIntegrationsStore.getState>["setTg"]>[0]) =>
  useIntegrationsStore.getState().setTg(p);

/** fetch that bypasses CORS inside Tauri (plugin-http) with browser fallback. */
async function tgFetch(method: string, body?: unknown, timeoutMs = 35000): Promise<Response> {
  const token = useSettingsStore.getState().telegramToken.trim();
  const doFetch = IS_TAURI ? (await import("@tauri-apps/plugin-http")).fetch : window.fetch.bind(window);
  const ctrl = new AbortController();
  abort = ctrl;
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await doFetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function tgCall<T>(method: string, body?: unknown, timeoutMs?: number): Promise<T> {
  const res = await tgFetch(method, body, timeoutMs);
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(data.description ?? `Telegram ${method} failed`);
  return data.result as T;
}

/** Send a text reply (splits messages > 4096 chars, Telegram's hard limit). */
async function sendText(chatId: number, text: string): Promise<void> {
  const chunks = text.match(/[\s\S]{1,3900}/g) ?? [];
  for (const chunk of chunks) {
    await tgCall("sendMessage", { chat_id: chatId, text: chunk }, 15000).catch(() => undefined);
  }
}

/* ── Main loop ────────────────────────────────────────────────────── */

/** Connect & start listening. Safe to call repeatedly (restarts cleanly). */
export async function startTelegram(): Promise<void> {
  stopTelegram();
  if (!isRemoteControlEnabled({ explicitOptIn: useSettingsStore.getState().telegramEnabled })) {
    setTg({ tgState: "error", tgDetail: "Remote phone control is disabled. Enable REMOTE_PHONE_CONTROL_ENABLED or Settings." });
    return;
  }
  const { telegramToken, telegramChatId } = useSettingsStore.getState();
  if (!telegramToken.trim()) {
    setTg({ tgState: "error", tgDetail: "No bot token — paste one from @BotFather." });
    return;
  }

  running = true;
  startedAt = Math.floor(Date.now() / 1000);
  setTg({ tgState: "connecting", tgDetail: "Validating bot token…" });

  /* 1 — validate token */
  let botName = "";
  try {
    const me = await tgCall<{ username: string }>("getMe", {}, 12000);
    botName = me.username;
  } catch (e) {
    running = false;
    setTg({ tgState: "error", tgDetail: `Token rejected: ${e instanceof Error ? e.message : e}` });
    return;
  }

  /* 2 — paired already? otherwise enter pairing mode with a fresh code */
  if (telegramChatId) {
    setTg({ tgState: "online", tgBotName: botName, tgDetail: `Linked — message @${botName} from your phone.`, tgPairCode: "" });
  } else {
    pairCode = generatePairCode();
    setTg({ tgState: "pairing", tgBotName: botName, tgPairCode: pairCode,
      tgDetail: `Open @${botName} in Telegram and send the 6-digit code.` });
  }

  /* 3 — long-poll loop */
  void pollLoop();
}

export function stopTelegram(): void {
  running = false;
  abort?.abort();
  setTg({ tgState: "off", tgDetail: "Not connected", tgPairCode: "" });
}

async function pollLoop(): Promise<void> {
  let failures = 0;
  while (running) {
    try {
      const updates = await tgCall<TgUpdate[]>(
        "getUpdates",
        { offset, timeout: 25, allowed_updates: ["message"] },
        35000,
      );
      failures = 0;
      for (const u of updates) {
        offset = Math.max(offset, u.update_id + 1);
        if (u.message?.text) await handleMessage(u.message);
      }
    } catch {
      if (!running) return;
      failures++;
      // backoff: 2s → 4s → 8s → max 30s, and surface persistent failures
      const wait = Math.min(30000, 2000 * 2 ** Math.min(failures, 4));
      if (failures >= 3) setTg({ tgState: "error", tgDetail: "Connection lost — retrying…" });
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

/* ── Message handling ─────────────────────────────────────────────── */

async function handleMessage(msg: NonNullable<TgUpdate["message"]>): Promise<void> {
  const text = (msg.text ?? "").trim();
  if (!text || !isFreshMessage(msg.date, startedAt)) return;

  const settings = useSettingsStore.getState();
  const linkedId = settings.telegramChatId;

  /* — pairing mode: only the correct code links a chat — */
  if (!linkedId) {
    if (text === pairCode && pairCode) {
      await settings.update({ telegramChatId: String(msg.chat.id) });
      setTg({ tgState: "online", tgPairCode: "",
        tgDetail: `Linked to ${msg.chat.first_name ?? "your phone"} — remote control active.` });
      notify("success", "Telegram paired — Cinem AI Assistant is now in your pocket.");
      await sendText(msg.chat.id,
        "✅ Paired with Cinem AI Assistant.\n\nSend me any command:\n• open google\n• morning briefing\n• post to instagram with caption 'Hello'\n• research <topic>\n• /status");
    } else {
      await sendText(msg.chat.id, "🔐 Cinem AI Assistant is in pairing mode. Send the 6-digit code shown in Settings → Integrations.");
    }
    return;
  }

  /* — security: refuse every chat except the linked one — */
  if (!isAuthorizedTelegramChat(linkedId, msg.chat.id)) {
    await sendText(msg.chat.id, "⛔ Not authorized. This Cinem AI Assistant belongs to someone else.");
    return;
  }

  const parsed = parseRemoteCommand(text);

  if (parsed.kind === "builtin") {
    if (parsed.builtin === "start" || parsed.builtin === "help") {
      await sendText(msg.chat.id,
        "🤖 Cinem AI Assistant remote control.\nJust type a command:\n• open youtube\n• post to tiktok …\n• morning briefing\n• /status — check the link\n• /unpair — unlink this chat");
      return;
    }
    if (parsed.builtin === "status") {
      await sendText(msg.chat.id, "🟢 Cinem AI Assistant online — PC connected, all systems nominal.");
      return;
    }
    if (parsed.builtin === "unpair") {
      await settings.update({ telegramChatId: "" });
      await sendText(msg.chat.id, "🔓 Unpaired. Send the new code from Settings to re-link.");
      pairCode = generatePairCode();
      setTg({ tgState: "pairing", tgPairCode: pairCode, tgDetail: "Unpaired — send the new code to re-link." });
      return;
    }
  }

  /* — full Cinem AI Assistant command (same pipeline as voice/chat) — */
  useIntegrationsStore.getState().bumpTg();
  await tgCall("sendChatAction", { chat_id: msg.chat.id, action: "typing" }, 8000).catch(() => undefined);
  try {
    const reply = await executeRemoteText(parsed.kind === "assistant" ? parsed.text : text);
    await sendText(msg.chat.id, reply || "✅ Done.");
  } catch (e) {
    await sendText(msg.chat.id, `⚠️ Command failed: ${e instanceof Error ? e.message : e}`);
  }
}
