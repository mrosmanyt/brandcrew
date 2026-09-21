/**
 * Privacy-safe topic tagging for Admin Insights.
 * Keyword matching only — no LLM. Redact PII before classify. Store tags, never text.
 */

export const ANALYTICS_FORBIDDEN_PAYLOAD_KEYS = [
  "body",
  "content",
  "email",
  "authorEmail",
  "guestKey",
  "userId",
  "message",
  "prompt",
  "text",
  "raw",
  "password",
  "passwordHash",
] as const;

export const ANALYTICS_TOPICS = [
  "billing",
  "login",
  "download",
  "gmail",
  "slack",
  "chrome",
  "desktop",
  "android",
  "api",
  "assistant",
  "support",
  "other",
] as const;

export type AnalyticsTopic = (typeof ANALYTICS_TOPICS)[number];

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;

const TOPIC_KEYWORDS: { topic: Exclude<AnalyticsTopic, "other">; re: RegExp }[] = [
  { topic: "billing", re: /\b(billing|invoice|charge|refund|payment|whop|stripe|subscription|pricing|upgrade|plan)\b/i },
  { topic: "login", re: /\b(log\s*in|sign[\s-]?in|password|oauth|google account)\b/i },
  { topic: "download", re: /\b(download|installer|setup\.exe|smartscreen)\b/i },
  { topic: "gmail", re: /\b(gmail|inbox)\b/i },
  { topic: "slack", re: /\bslack\b/i },
  { topic: "chrome", re: /\b(chrome|extension|mv3)\b/i },
  { topic: "desktop", re: /\b(desktop|windows|electron|cinem-pro-setup)\b/i },
  { topic: "android", re: /\b(android|play store)\b/i },
  { topic: "api", re: /\b(api key|developer api|\/api\/v1)\b/i },
  { topic: "assistant", re: /\b(assistant|hey cinem|wake word)\b/i },
  { topic: "support", re: /\b(helpdesk|live chat|support ticket)\b/i },
];

/** Strip email, phone, and URLs before topic classify. Never persist the input. */
export function redactAnalyticsText(raw: string): string {
  return String(raw || "")
    .replace(EMAIL_RE, "[email]")
    .replace(URL_RE, "[url]")
    .replace(PHONE_RE, "[phone]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

/** Keyword topics from already-redacted text. Empty / unmatched → `other`. */
export function classifyAnalyticsTopics(redacted: string): AnalyticsTopic[] {
  const text = redactAnalyticsText(redacted);
  if (!text) return ["other"];
  const hits = TOPIC_KEYWORDS.filter((row) => row.re.test(text)).map((row) => row.topic);
  return hits.length > 0 ? [...new Set(hits)] : ["other"];
}

export function topicsFromUserText(raw: string): AnalyticsTopic[] {
  return classifyAnalyticsTopics(redactAnalyticsText(raw));
}

export function payloadHasForbiddenAnalyticsKey(value: unknown, path = ""): string | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = payloadHasForbiddenAnalyticsKey(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if ((ANALYTICS_FORBIDDEN_PAYLOAD_KEYS as readonly string[]).includes(lower)) {
      return path ? `${path}.${key}` : key;
    }
    const hit = payloadHasForbiddenAnalyticsKey(child, path ? `${path}.${key}` : key);
    if (hit) return hit;
  }
  return null;
}
