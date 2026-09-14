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
export const HELPDESK_ACK_MAX = 900;
export const HELPDESK_PRESENCE_WINDOW_MS = 90_000;
export const HELPDESK_PRESENCE_ID = "founder";
export const HELPDESK_GUEST_STORAGE_KEY = "cinem_helpdesk_guest";
/** Cap LLM replies so POST /api/support always returns. Canned FAQ is instant. */
export const HELPDESK_ACK_BUDGET_MS = 3500;
/** Browser abort so a hung Help POST surfaces a retry instead of an infinite spinner. */
export const HELPDESK_CLIENT_TIMEOUT_MS = 12_000;
export const HELPDESK_CLIENT_RETRIES = 1;

/** Canonical desk origin — marketing hosts (cinem.tech) pin Help API here. */
export const HELPDESK_APP_ORIGIN = "https://app.cinem.tech";
export const HELPDESK_MARKETING_ORIGINS = [
  "https://cinem.tech",
  "https://www.cinem.tech",
] as const;

export const HELPDESK_ONLINE_STATUS = "Online — ask anything";

export const HELPDESK_CHAT_FALLBACK =
  "I'm CINEM Help — online and ready. Ask about the Windows download, plans, sign-in, SmartScreen, or what CINEM Pro is. If something is broken on your account, say so and I'll escalate it to the team.";

export const HELPDESK_FALLBACK_ACK =
  "I've escalated this to the CINEM team. They'll follow up in this thread. You can keep writing here.";

export const HELPDESK_ESCALATE_ACK = HELPDESK_FALLBACK_ACK;

export const HELPDESK_LIVE_AVAILABLE_ACK =
  "I've asked the CINEM team to join this chat. Keep writing here — they'll pick it up in this thread.";

export const HELPDESK_LIVE_OFFLINE_ACK = HELPDESK_LIVE_AVAILABLE_ACK;

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

export function helpdeskPresenceLabel(): string {
  return HELPDESK_ONLINE_STATUS;
}

export function helpdeskNetworkErrorMessage(error: unknown): string {
  if (isHelpdeskRetryableNetworkError(error)) {
    return "Could not reach CINEM Help. Check your connection and try again.";
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Could not send that.";
}

export function isHelpdeskRetryableNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  return (
    error instanceof Error &&
    /failed to fetch|networkerror|load failed|network request failed/i.test(error.message)
  );
}

export type HelpdeskRoute = "answer" | "escalate";
export type HelpdeskTopic =
  | "greeting"
  | "thanks"
  | "product"
  | "download"
  | "smartscreen"
  | "plans"
  | "signin"
  | "assistant"
  | "api"
  | "agents"
  | "chrome"
  | "support_tip";

export type HelpdeskClassification = {
  route: HelpdeskRoute;
  topic?: HelpdeskTopic;
  looksLikeIssue: boolean;
};

const GREETING_RE = /^(hi|hii+|hello|hey|yo|salaam|salam|thanks|thank you|thx|ok|okay|cool)[\s!.]*$/i;
const THANKS_RE = /\b(thanks|thank you|thx|shukriya|cheers)\b/i;
const DOWNLOAD_RE =
  /\b(download|installer|setup\.exe|cinem-pro-setup|windows app|desktop app|portable|\.exe|mac(\s+app)?|dmg|android|play store)\b/i;
const SMARTSCREEN_RE = /\b(smartscreen|windows protected|more info|run anyway|unrecognized app|publisher)\b/i;
const PLANS_RE =
  /\b(pric(e|ing)|plans?|how much|subscription|pro plus|ultra|token|seats?|upgrade|free plan|credits)\b/i;
const SIGNIN_RE =
  /\b(sign ?in|sign ?up|log ?in|log ?on|password|google (login|sign)|can'?t (log|sign)|session|forgot)\b/i;
const PRODUCT_RE =
  /\b(what is cinem|what'?s cinem|cinem pro|ai employee|what does (this|it|cinem) do|how does (this|cinem) work)\b/i;
const ASSISTANT_RE = /\b(ai assistant|cinem ai|assistant mode|windows assistant)\b/i;
const API_RE = /\b(api (key|console|v1)|developer api|from my (own )?app)\b/i;
const AGENTS_RE =
  /\b(create (an )?agent|add (an )?agent|how (do i|to) (use |make )?agents?|what( is|'s) an agent)\b/i;
const CHROME_RE = /\b(chrome extension|browser extension|pair(ing)? code)\b/i;
const TIP_RE = /\b(tip|donate|supporter badge|support cinem)\b/i;
const ESCALATE_RE =
  /\b(bug|broken|crash|refund|charg(ed|e)|billing error|invoice|hacked|stolen|locked out|can'?t access|not working|doesn'?t work|won'?t load|stuck|blank screen|escalate|talk to (a )?(human|person|founder|team)|speak to|account (issue|problem)|unauthorized|500|403)\b/i;
const ISSUE_HINT_RE =
  /\b(i'?m seeing|this (error|issue|bug)|when i|it (fails|failed|broke)|please (fix|help)|urgent)\b/i;

export function looksLikeHelpdeskIssue(raw: string): boolean {
  const text = clipHelpdeskText(raw, 800);
  if (!text) return false;
  if (ESCALATE_RE.test(text) || ISSUE_HINT_RE.test(text)) return true;
  return text.length >= 180;
}

export function classifyHelpdeskMessage(
  raw: string,
  opts?: { liveRequested?: boolean },
): HelpdeskClassification {
  const text = clipHelpdeskText(raw, 800);
  const looksLikeIssue = looksLikeHelpdeskIssue(text);
  if (opts?.liveRequested) {
    return { route: "escalate", looksLikeIssue: true };
  }
  if (!text) return { route: "answer", topic: "greeting", looksLikeIssue: false };
  if (ESCALATE_RE.test(text)) return { route: "escalate", looksLikeIssue: true };
  if (GREETING_RE.test(text)) return { route: "answer", topic: "greeting", looksLikeIssue: false };
  if (SMARTSCREEN_RE.test(text)) return { route: "answer", topic: "smartscreen", looksLikeIssue: false };
  if (DOWNLOAD_RE.test(text)) return { route: "answer", topic: "download", looksLikeIssue: false };
  if (PLANS_RE.test(text)) return { route: "answer", topic: "plans", looksLikeIssue: false };
  if (SIGNIN_RE.test(text)) return { route: "answer", topic: "signin", looksLikeIssue: false };
  if (ASSISTANT_RE.test(text)) return { route: "answer", topic: "assistant", looksLikeIssue: false };
  if (API_RE.test(text)) return { route: "answer", topic: "api", looksLikeIssue: false };
  if (AGENTS_RE.test(text)) return { route: "answer", topic: "agents", looksLikeIssue: false };
  if (CHROME_RE.test(text)) return { route: "answer", topic: "chrome", looksLikeIssue: false };
  if (TIP_RE.test(text)) return { route: "answer", topic: "support_tip", looksLikeIssue: false };
  if (PRODUCT_RE.test(text)) return { route: "answer", topic: "product", looksLikeIssue: false };
  if (THANKS_RE.test(text) && text.length < 80) {
    return { route: "answer", topic: "thanks", looksLikeIssue: false };
  }
  if (looksLikeIssue) return { route: "escalate", looksLikeIssue: true };
  return { route: "answer", looksLikeIssue: false };
}

export function helpdeskCannedReply(topic: HelpdeskTopic): string {
  switch (topic) {
    case "greeting":
      return HELPDESK_CHAT_FALLBACK;
    case "thanks":
      return "Glad that helped. I'm still here — ask about download, plans, sign-in, or anything else.";
    case "product":
      return "CINEM Pro is an AI employee desk. You create agents, give them jobs, and approve what leaves — email, posts, and browser work wait for you. Open the desk from Get started, or ask me about download, plans, or sign-in.";
    case "download":
      return "Windows: open /download and get CINEM-Pro-Setup.exe. That one installer is the cloud desk plus Cinem AI Assistant — pick the mode in the app. There is no hosted Mac .dmg; use the web desk at app.cinem.tech, or build on a Mac. Android is package tech.cinem.pro when the Play listing is live.";
    case "smartscreen":
      return "Unsigned Windows builds can trip SmartScreen. Click More info, then Run anyway. The file is CINEM-Pro-Setup.exe from /download. After install, sign in with the same CINEM account you use on the website.";
    case "plans":
      return "Signup starts on Free (capped — there is no unlimited plan). Pro is $20/month (2 seats, 50k job tokens). Pro Plus is $79/month (5 seats, 200k). Ultra is $200/month (12 seats, 600k). Cinem AI Assistant is included with those plans, not a second purchase. Open Plans in the desk to upgrade. Credits wrap token budgets 1:1.";
    case "signin":
      return "Use the same CINEM account on the website, Windows app, and Chrome extension. Open /login — email or Continue with Google. Desktop and the extension pair to that account; they do not create a second login.";
    case "assistant":
      return "Cinem AI Assistant is Windows-only and ships in CINEM-Pro-Setup.exe with the desk. Switch Desk / AI Assistant / both in the app. It uses your existing Free, Pro, Pro Plus, or Ultra plan.";
    case "api":
      return "Yes — the API Console (same-origin /console) mints workspace keys for /api/v1. Jobs still wait for approval before anything is sent. Do not use console.cinem.tech — that host is not live.";
    case "agents":
      return "In the desk, open Mission Control and create an agent. Give it a job in chat — browse, draft, or research. Email, Slack posts, and payments wait for your approval. Ask me about download or sign-in if you are not in the desk yet.";
    case "chrome":
      return "On-device Chrome lives under Settings → Desk tools. Download the extension from /download, then Sign in with CINEM in the popup so it attaches to your workspace. Pairing codes still work. This is not a second account.";
    case "support_tip":
      return "The Help thread is product help. A one-time tip is a separate checkout on /support — it adds a Supporter badge and does not change Free / Pro / Pro Plus / Ultra.";
  }
}

export type HelpdeskReplyPlan = {
  route: HelpdeskRoute;
  useLlm: boolean;
  topic?: HelpdeskTopic;
  template: string;
};

/**
 * FAQ + live/escalate stay on canned copy so POST /api/support never waits on a model.
 * Unknown small questions may use a time-boxed classify call.
 */
export function helpdeskReplyPlan(
  classified: HelpdeskClassification,
  opts?: { liveRequested?: boolean },
): HelpdeskReplyPlan {
  if (opts?.liveRequested) {
    return { route: "escalate", useLlm: false, template: HELPDESK_LIVE_AVAILABLE_ACK };
  }
  if (classified.route === "escalate") {
    return { route: "escalate", useLlm: false, template: HELPDESK_ESCALATE_ACK };
  }
  if (classified.topic) {
    return {
      route: "answer",
      useLlm: false,
      topic: classified.topic,
      template: helpdeskCannedReply(classified.topic),
    };
  }
  return { route: "answer", useLlm: true, template: HELPDESK_CHAT_FALLBACK };
}

export function helpdeskApiUrl(path: string, pageOrigin?: string | null): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const origin = (pageOrigin || "").replace(/\/$/, "").toLowerCase();
  if ((HELPDESK_MARKETING_ORIGINS as readonly string[]).includes(origin)) {
    return `${HELPDESK_APP_ORIGIN}${normalized}`;
  }
  return normalized;
}

export function helpdeskCorsOrigin(requestOrigin?: string | null): string | null {
  const origin = (requestOrigin || "").trim().replace(/\/$/, "");
  if (!origin) return null;
  const allowed = new Set<string>([
    HELPDESK_APP_ORIGIN,
    ...HELPDESK_MARKETING_ORIGINS,
    "https://brandcrew.vercel.app",
  ]);
  return allowed.has(origin) ? origin : null;
}

export function isHelpdeskCorsPath(segments: string[]): boolean {
  return segments[0] === "api" && segments[1] === "support";
}

export function helpdeskCorsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-cinem-help-key",
    Vary: "Origin",
  };
}

export function nextStatusAfterHelpReply(input: {
  liveActive: boolean;
  liveRequested: boolean;
  route: HelpdeskRoute;
}): HelpdeskStatus {
  if (input.liveActive) return "live";
  if (input.liveRequested || input.route === "escalate") return "open";
  return "replied";
}

export function nextStatusAfterUserMessage(input: {
  liveActive: boolean;
  liveRequested: boolean;
  founderAvailable: boolean;
  current: string;
  route?: HelpdeskRoute;
}): HelpdeskStatus {
  if (input.route) {
    return nextStatusAfterHelpReply({
      liveActive: input.liveActive,
      liveRequested: input.liveRequested,
      route: input.route,
    });
  }
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

export function helpdeskAckForLiveRequest(_founderAvailable?: boolean): string {
  return HELPDESK_LIVE_AVAILABLE_ACK;
}

export function sanitizeHelpdeskAck(text: string): string {
  const cleaned = clipHelpdeskText(String(text || "").replace(PROVIDER_LEAK, "CINEM"), HELPDESK_ACK_MAX);
  return cleaned || HELPDESK_CHAT_FALLBACK;
}

export function helpdeskAckSystemPrompt(): string {
  return [
    "You are CINEM Help — the in-product chatbot for CINEM Pro. CINEM Pro made you.",
    "Default to English when the user's language is unclear. Mirror their language if they write in another language (including Urdu / Roman Urdu).",
    "Never claim you are English-only. Never name third-party AI labs, models, or providers. Never say the CINEM team is offline.",
    "Small product questions (download, Windows SmartScreen, plans, sign-in, what CINEM Pro is, the Windows assistant, API Console): answer them yourself in 2-5 short sentences. Be specific. Point at /download, /login, /console, or desk Plans when useful.",
    "Facts: Windows installer is CINEM-Pro-Setup.exe from /download (desk + Cinem AI Assistant). SmartScreen → More info → Run anyway. No hosted Mac .dmg — use the web desk. Free / Pro $20 / Pro Plus $79 / Ultra $200, all capped. Same account for web and desktop.",
    "Account, billing disputes, refunds, bugs, access problems, or anything you cannot answer: briefly help if you can, then say you escalated it to the CINEM team and they will reply in this same thread.",
    "Never promise a phone call or a separate email. Never mention the /support tip page unless they asked about tipping CINEM.",
  ].join(" ");
}

export type HelpdeskAckContext = {
  founderAvailable: boolean;
  liveRequested: boolean;
  pageUrl?: string;
  route?: HelpdeskRoute;
};

export function helpdeskAckUserPrompt(message: string, context: HelpdeskAckContext): string {
  const bits = [`User message:\n${clipHelpdeskText(message, 800)}`];
  if (context.liveRequested) {
    bits.push("They tapped Request live chat. Do not say the team is offline. Say you asked the CINEM team to join this thread.");
  } else if (context.route === "escalate") {
    bits.push("This is an escalation (account, billing, bug, or they asked for a human). Briefly help if you can, then say you escalated it to the CINEM team. They will reply in this thread.");
  } else {
    bits.push("Answer as CINEM Help. If you cannot answer from product facts, escalate to the CINEM team in this thread.");
  }
  if (context.pageUrl) bits.push(`Page: ${context.pageUrl}`);
  bits.push("Write only the customer-facing reply. Do not name providers. Do not say offline.");
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
