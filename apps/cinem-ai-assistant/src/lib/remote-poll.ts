/**
 * Desktop poller — fetches cloud-queued remote commands (WhatsApp Cloud / companion)
 * and runs them through the orchestrator, then posts replies.
 */
import { ackCompanionReminder, pollCompanionReminders } from "@/lib/companionCloud";
import { companionSignedIn } from "@/lib/companionCloud";
import { executeRemoteText } from "@/lib/remote-control/queue";
import { isRemoteControlEnabled } from "@/lib/remote-control/feature";
import { sendWhatsAppCloudReply } from "@/lib/whatsapp-cloud-client";

let timer: ReturnType<typeof setInterval> | undefined;
let running = false;

const POLL_MS = 12_000;

export function startRemotePoll(): void {
  if (running || !isRemoteControlEnabled({ explicitOptIn: companionSignedIn() })) return;
  running = true;
  void tick();
  timer = setInterval(() => void tick(), POLL_MS);
}

export function stopRemotePoll(): void {
  running = false;
  if (timer) clearInterval(timer);
  timer = undefined;
}

async function tick(): Promise<void> {
  if (!companionSignedIn()) return;
  try {
    const data = await pollCompanionReminders();
    const commands = (data.commands as {
      id: string;
      action: string;
      payload: Record<string, unknown>;
    }[]) ?? [];

    for (const cmd of commands) {
      if (cmd.action !== "assistant_command" && cmd.action !== "reminder") continue;
      const text =
        cmd.action === "assistant_command"
          ? String(cmd.payload?.text ?? "").trim()
          : String(cmd.payload?.text ?? cmd.payload?.reminderText ?? "").trim();
      if (!text) {
        await ackCompanionReminder(cmd.id, { ok: false, error: "empty command" });
        continue;
      }
      const reply = await executeRemoteText(text);
      const channel = String(cmd.payload?.channel ?? "");
      const sourceId = String(cmd.payload?.sourceId ?? "");
      if (channel === "whatsapp_cloud" && sourceId) {
        await sendWhatsAppCloudReply(sourceId, reply).catch(() => undefined);
      }
      await ackCompanionReminder(cmd.id, { ok: true, reply });
    }
  } catch {
    /* retry next tick */
  }
}
