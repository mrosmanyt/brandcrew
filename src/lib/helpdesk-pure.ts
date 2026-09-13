/**
 * Product helpdesk (Help widget → Admin HQ).
 * Separate from Whop / BrandSupport tips on /support.
 */

export const HELPDESK_STATUSES = ["open", "live", "replied", "closed"] as const;
export type HelpdeskStatus = (typeof HELPDESK_STATUSES)[number];

export const HELPDESK_ROLES = ["user", "ai", "founder"] as const;
export type HelpdeskRole = (typeof HELPDESK_ROLES)[number];

export const HELPDESK_MESSAGE_MAX = 4000;
export const HELPDESK_PAGE_URL_MAX = 500;
export const HELPDESK_PREVIEW_MAX = 160;
export const HELPDESK_ACK_MAX = 600;
export const HELPDESK_PRESENCE_WINDOW_MS = 90_000;
export const HELPDESK_PRESENCE_ID = "founder";
export const HELPDESK_GUEST_STORAGE_KEY = "cinem_helpdesk_guest";

export const HELPDESK_FALLBACK_ACK =
  "Thanks — I've forwarded this to the CINEM team. Someone will follow up in this thread. If you need a live conversation, tap Request live chat.";

export const HELPDESK_LIVE_AVAILABLE_ACK =
  "Thanks — I've forwarded this to the CINEM team. A teammate is available and can join this chat shortly.";

export const HELPDESK_LIVE_OFFLINE_ACK =
  "Thanks — I've forwarded this to the CINEM team. Nobody is live right now, so this is queued as a ticket and we'll reply here.";

export const HELPDESK_JOINED_NOTE =
  "A CINEM teammate joined this chat and will reply here.";

export const HELPDESK_CLOSED_NOTE =
  "This help thread is closed. Send another message if you still need us.";

const PROVIDER_LEAK =
  /\b(openai|anthropic|gemini|claude|gpt-?[45]|gpt-4o|xai|grok|haiku|sonnet|opus)\b/gi;

export function parseHelpdeskStatus(raw?: string | null): HelpdeskStatus {
  const value = (raw ?? "").trim().toLowerCase();
  if ((HELPDESK_STATUSES as readonly string[]).includes(value)) {
    return value as HelpdeskStatus;
  }
  return "open";
}

export function isHelpdeskStatus(raw?: string | null): raw is HelpdeskStatus {
  return (HELPDESK_STATUSES as readonly string[]).includes((raw ?? "").trim().toLowerCase());
}

export function isHelpdeskRole(raw?: string | null): raw is HelpdeskRole {
  return (HELPDESK_ROLES as readonly string[]).includes((raw ?? "").trim().toLowerCase());
}

export function clipHelpdeskText(raw: string, max: number): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, max);
}

export function helpdeskPreview(body: string): string {
  return clipHelpdeskText(body, HELPDESK_PREVIEW_MAX);
}

export function normalizeHelpdeskPageUrl(raw?: string | null): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  if (value.length > HELPDESK_PAGE_URL_MAX) return value.slice(0, HELPDESK_PAGE_URL_MAX);
  if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
  return "";
}

export function isValidHelpdeskEmail(raw?: string | null): boolean {
  const email = (raw ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 180;
}

export function founderIsAvailable(lastSeenAt?: Date | string | null, now = Date.now()): boolean {
  if (!lastSeenAt) return false;
  const ms = typeof lastSeenAt === "string" ? Date.parse(lastSeenAt) : lastSeenAt.getTime();
  if (!Number.isFinite(ms)) return false;
  return now - ms <= HELPDESK_PRESENCE_WINDOW_MS;
}

export function shouldAutoAckUserMessage(input: {
  liveActive: boolean;
  status: string;
}): boolean {
  if (input.liveActive) return false;
  if (parseHelpdeskStatus(input.status) === "live") return false;
  return true;
}

export function nextStatusAfterUserMessage(input: {
  liveActive: boolean;
  liveRequested: boolean;
  founderAvailable: boolean;
  current: string;
}): HelpdeskStatus {
  if (input.liveActive) return "live";
  if (input.liveRequested && input.founderAvailable) return "open";
  const current = parseHelpdeskStatus(input.current);
  if (current === "closed") return "open";
  if (current === "replied") return "open";
  if (current === "live") return "open";
  return current;
}

export function nextStatusAfterFounderReply(liveActive: boolean): HelpdeskStatus {
  return liveActive ? "live" : "replied";
}

export function helpdeskAckForLiveRequest(founderAvailable: boolean): string {
  return founderAvailable ? HELPDESK_LIVE_AVAILABLE_ACK : HELPDESK_LIVE_OFFLINE_ACK;
}

export function sanitizeHelpdeskAck(text: string): string {
  const cleaned = clipHelpdeskText(String(text || "").replace(PROVIDER_LEAK, "CINEM"), HELPDESK_ACK_MAX);
  return cleaned || HELPDESK_FALLBACK_ACK;
}

export function helpdeskAckSystemPrompt(): string {
  return [
    "You are CINEM Pro Help — the product helpdesk front door.",
    "Reply in English only, in 1-3 short professional sentences.",
    "Acknowledge that you received the user's query or issue and that you are forwarding it to the CINEM team.",
    "They will hear back in this same Help thread. Do not promise a phone call or email outside this thread.",
    "If they asked for live chat and the team is available, say a teammate can join shortly.",
    "If they asked for live chat and the team is offline, say it is queued as a ticket.",
    "Never name third-party AI labs, models, or providers. Never mention Whop tips unless they asked about tipping CINEM.",
    "Do not invent account changes, refunds, or technical fixes. The team will handle the request.",
  ].join(" ");
}

export type HelpdeskAckContext = {
  founderAvailable: boolean;
  liveRequested: boolean;
  pageUrl?: string;
};

export function helpdeskAckUserPrompt(message: string, context: HelpdeskAckContext): string {
  const bits = [`User message:\n${clipHelpdeskText(message, 800)}`];
  if (context.liveRequested) {
    bits.push(
      context.founderAvailable
        ? "They requested live chat. A CINEM teammate is available now."
        : "They requested live chat. The team is offline — queue as a ticket.",
    );
  } else {
    bits.push("They did not request live chat. Confirm the ticket was forwarded.");
  }
  if (context.pageUrl) bits.push(`Page: ${context.pageUrl}`);
  bits.push("Write the English acknowledgement only.");
  return bits.join("\n");
}

export type HelpdeskViewer = {
  signedIn: boolean;
  email: string;
  name: string;
};

export type HelpdeskMessageDTO = {
  id: string;
  role: HelpdeskRole;
  body: string;
  authorEmail: string;
  createdAt: string;
};

export type HelpdeskThreadDTO = {
  id: string;
  email: string;
  name: string;
  workspaceId: string | null;
  pageUrl: string;
  preview: string;
  status: HelpdeskStatus;
  liveRequested: boolean;
  liveActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  guestKey?: string;
  messages?: HelpdeskMessageDTO[];
};

export type HelpdeskInbox = {
  section: "support";
  founderAvailable: boolean;
  lastSeenAt: string | null;
  open: number;
  live: number;
  threads: HelpdeskThreadDTO[];
};

export function isHelpdeskAdminHiddenPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
