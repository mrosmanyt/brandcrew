/**
 * Parse remote commands from Telegram / WhatsApp text.
 */

export type RemoteBuiltin = "help" | "status" | "unpair" | "start";

export interface ParsedRemoteCommand {
  kind: "builtin";
  builtin: RemoteBuiltin;
}

export interface ParsedAssistantCommand {
  kind: "assistant";
  text: string;
}

export type RemoteCommand = ParsedRemoteCommand | ParsedAssistantCommand;

const BUILTIN_MAP: Record<string, RemoteBuiltin> = {
  "/start": "start",
  "/help": "help",
  "/status": "status",
  "/unpair": "unpair",
};

/** Split compound commands on newlines or `;` / `&&`. */
export function splitCompoundCommand(text: string): string[] {
  return text
    .split(/\n|&&|;/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseRemoteCommand(text: string): RemoteCommand {
  const trimmed = text.trim();
  const builtin = BUILTIN_MAP[trimmed.toLowerCase()];
  if (builtin) return { kind: "builtin", builtin };
  return { kind: "assistant", text: trimmed };
}

/** True when text looks like a multi-step compound remote job. */
export function isCompoundCommand(text: string): boolean {
  return splitCompoundCommand(text).length > 1;
}
