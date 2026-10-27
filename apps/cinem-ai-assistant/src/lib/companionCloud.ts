/**
 * Mobile companion cloud API — pairing + remote commands.
 */
import { readSession, withFreshAccess } from "@/lib/cinemCloud";

export type CompanionPairSession = {
  pairId: string;
  pairCode: string;
  commandToken: string;
  expiresAt: string;
  pairUrl: string;
  deepLink: string;
  qrUrl: string;
};

async function authedFetch(path: string, init: RequestInit = {}) {
  return withFreshAccess(async (accessToken) => {
    const { cinemCloudOrigin } = await import("@/lib/cinemCloud");
    const res = await fetch(`${cinemCloudOrigin()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Cinem-Client": "assistant",
        ...(init.headers || {}),
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  });
}

export async function startCompanionPair(workspaceId?: string): Promise<CompanionPairSession> {
  return authedFetch("/api/companion/pair", {
    method: "POST",
    body: JSON.stringify(workspaceId ? { workspaceId } : {}),
  });
}

export async function claimCompanionPair(pairCode: string) {
  return authedFetch("/api/companion/pair", {
    method: "PUT",
    body: JSON.stringify({ pairCode }),
  });
}

export async function fetchCompanionStatus() {
  return authedFetch("/api/companion/pair");
}

export async function sendCompanionCommand(input: {
  token: string;
  action: "research" | "reminder" | "assistant_command";
  query?: string;
  reminderText?: string;
  reminderAt?: string;
  text?: string;
  channel?: string;
  sourceId?: string;
}) {
  return authedFetch("/api/companion/command", {
    method: "POST",
    headers: { "X-Companion-Token": input.token },
    body: JSON.stringify(input),
  });
}

export async function pollCompanionReminders() {
  return authedFetch("/api/companion/commands");
}

export async function ackCompanionReminder(commandId: string, result: Record<string, unknown> = { ok: true }) {
  return authedFetch("/api/companion/commands", {
    method: "PATCH",
    body: JSON.stringify({ commandId, result }),
  });
}

export function companionSignedIn() {
  return Boolean(readSession()?.accessToken || readSession()?.refreshToken);
}
