/**
 * In-memory remote command queue (phone → desktop orchestrator).
 * Cloud-queued commands use Postgres via /api/companion/commands.
 */
import { processCommand } from "@/lib/orchestrator";
import { splitCompoundCommand } from "./command-parser";

export interface RemoteJob {
  id: string;
  channel: "telegram" | "whatsapp" | "whatsapp_cloud" | "companion";
  text: string;
  enqueuedAt: number;
}

export type RemoteProgress = (message: string) => void;

const queue: RemoteJob[] = [];
let processing = false;

export function enqueueRemoteJob(job: Omit<RemoteJob, "id" | "enqueuedAt">): RemoteJob {
  const row: RemoteJob = {
    ...job,
    id: `rj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enqueuedAt: Date.now(),
  };
  queue.push(row);
  return row;
}

export function remoteQueueDepth(): number {
  return queue.length;
}

/** Execute one or more commands through the orchestrator; compound jobs run sequentially. */
export async function executeRemoteText(
  text: string,
  onProgress?: RemoteProgress,
): Promise<string> {
  const parts = splitCompoundCommand(text);
  const replies: string[] = [];
  for (const part of parts) {
    onProgress?.(`Running: ${part.slice(0, 80)}${part.length > 80 ? "…" : ""}`);
    try {
      const reply = await processCommand(part);
      replies.push(reply || "✅ Done.");
    } catch (e) {
      replies.push(`⚠️ ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return replies.join("\n\n");
}

/** Drain the in-memory queue (desktop poller). */
export async function drainRemoteQueue(onProgress?: RemoteProgress): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    while (queue.length) {
      const job = queue.shift();
      if (!job) break;
      job.text = await executeRemoteText(job.text, onProgress);
    }
  } finally {
    processing = false;
  }
}
