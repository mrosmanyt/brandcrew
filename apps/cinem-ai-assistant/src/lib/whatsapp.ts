/**
 * WHATSAPP REMOTE CONTROL — control Cinem AI Assistant from your own WhatsApp.
 *
 * Pipeline (driven by the Playwright sidecar, see /playwright-server):
 *   1. Sidecar opens WhatsApp Web in its own persistent Chromium profile —
 *      the user scans the QR code ONCE; the session survives restarts.
 *   2. Cinem AI Assistant opens the user's OWN chat ("Message yourself"). Security is
 *      inherent: only the account owner can write into that chat.
 *   3. Every new message in that chat = a Cinem AI Assistant command (full orchestrator
 *      pipeline). Replies are typed back into the same chat, prefixed with
 *      🤖 so Cinem AI Assistant never reacts to its own messages.
 *
 * From the phone: open WhatsApp → "Message yourself" → "open google".
 */
import { useIntegrationsStore } from "@/store/useIntegrationsStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { notify } from "@/store/useToastStore";
import { isRemoteControlEnabled } from "@/lib/remote-control/feature";
import { executeRemoteText } from "@/lib/remote-control/queue";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const PW_BASE = "http://127.0.0.1:7878";
const BOT_PREFIX = "🤖"; // marks Cinem AI Assistant's own replies (loop protection)

let running = false;
let timer: ReturnType<typeof setTimeout> | undefined;

const setWa = (p: Parameters<ReturnType<typeof useIntegrationsStore.getState>["setWa"]>[0]) =>
  useIntegrationsStore.getState().setWa(p);

async function wa(path: string, body?: unknown, timeoutMs = 20000): Promise<Record<string, unknown>> {
  const doFetch = IS_TAURI ? (await import("@tauri-apps/plugin-http")).fetch : window.fetch.bind(window);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await doFetch(`${PW_BASE}${path}`, {
      method: body !== undefined ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    return (await res.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(t);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Start the WhatsApp bridge. Safe to call repeatedly. */
export async function startWhatsApp(): Promise<void> {
  stopWhatsApp();
  if (!isRemoteControlEnabled({ explicitOptIn: useSettingsStore.getState().waEnabled })) {
    setWa({ waState: "error", waDetail: "Remote phone control is disabled. Enable REMOTE_PHONE_CONTROL_ENABLED or Settings." });
    return;
  }
  const { waNumber } = useSettingsStore.getState();
  if (!waNumber.trim()) {
    setWa({ waState: "error", waDetail: "Enter your own WhatsApp number first." });
    return;
  }

  running = true;
  setWa({ waState: "starting", waDetail: "Contacting Playwright sidecar…" });

  /* 1 — sidecar reachable? */
  try {
    await wa("/health", undefined, 2500);
  } catch {
    running = false;
    setWa({ waState: "error", waDetail: "Sidecar offline — run `npm start` in /playwright-server first." });
    return;
  }

  /* 2 — launch WhatsApp Web (persistent profile) */
  try {
    await wa("/wa/start", {}, 70000);
  } catch (e) {
    running = false;
    setWa({ waState: "error", waDetail: `WhatsApp launch failed: ${e instanceof Error ? e.message : e}` });
    return;
  }

  /* 3 — wait for login (QR scan on first run) */
  setWa({ waState: "qr", waDetail: "Scan the QR code in the Chromium window (first time only)…" });
  const deadline = Date.now() + 3 * 60 * 1000;
  while (running) {
    const st = await wa("/wa/status", undefined, 8000).catch(() => null);
    if (st?.loggedIn) break;
    if (Date.now() > deadline) {
      running = false;
      setWa({ waState: "error", waDetail: "QR scan timed out — press Start again." });
      return;
    }
    await sleep(2500);
  }
  if (!running) return;

  /* 4 — open the self-chat ("Message yourself") */
  setWa({ waState: "starting", waDetail: "Opening your self-chat…" });
  try {
    await wa("/wa/open-self", { query: waNumber.trim() }, 30000);
  } catch {
    running = false;
    setWa({ waState: "error", waDetail: "Couldn't find your self-chat — check the number (with country code)." });
    return;
  }

  setWa({ waState: "online", waDetail: "Online — message yourself on WhatsApp to command Cinem AI Assistant." });
  notify("success", "WhatsApp link established — LEO is listening.");
  void pollLoop();
}

export function stopWhatsApp(): void {
  running = false;
  clearTimeout(timer);
  setWa({ waState: "off", waDetail: "Not connected" });
}

/** Fully shut the sidecar's WhatsApp browser too (Settings "Stop"). */
export async function stopWhatsAppHard(): Promise<void> {
  stopWhatsApp();
  await wa("/wa/stop", {}, 8000).catch(() => undefined);
}

/* ── Poll → execute → reply loop ──────────────────────────────────── */
async function pollLoop(): Promise<void> {
  let failures = 0;
  while (running) {
    try {
      const res = await wa("/wa/poll", undefined, 12000);
      failures = 0;
      const msgs = (res.messages as { id: string; text: string }[] | undefined) ?? [];
      for (const m of msgs) {
        const text = m.text.trim();
        if (!text || text.startsWith(BOT_PREFIX)) continue; // our own reply
        useIntegrationsStore.getState().bumpWa();
        try {
          const reply = await executeRemoteText(text);
          await wa("/wa/send", { text: `${BOT_PREFIX} ${reply || "✅ Done."}` }, 25000);
        } catch (e) {
          await wa("/wa/send", { text: `${BOT_PREFIX} ⚠️ Failed: ${e instanceof Error ? e.message : e}` }, 25000)
            .catch(() => undefined);
        }
      }
    } catch {
      if (!running) return;
      failures++;
      if (failures >= 3) setWa({ waState: "error", waDetail: "Lost contact with WhatsApp window — retrying…" });
      if (failures >= 10) {
        stopWhatsApp();
        setWa({ waState: "error", waDetail: "WhatsApp bridge stopped (window closed?). Press Start to relink." });
        return;
      }
    }
    await sleep(3000);
  }
}
