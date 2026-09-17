import { ApiRateLimitError } from "@/lib/http";

type Bucket = { count: number; resetAt: number };

/** Per-isolate token window. Hobby has no Upstash — best-effort per instance. */
const buckets = new Map<string, Bucket>();
const MAX_KEYS = 4000;

export type RateWindow = {
  key: string;
  limit: number;
  windowMs: number;
};

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 128);
  return "unknown";
}

function prune(now: number) {
  if (buckets.size < MAX_KEYS) return;
  for (const [key, row] of buckets) {
    if (row.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size >= MAX_KEYS) {
    const extra = buckets.size - Math.floor(MAX_KEYS / 2);
    let dropped = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      dropped += 1;
      if (dropped >= extra) break;
    }
  }
}

export function takeToken(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  prune(now);
  const current = buckets.get(key);
  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (current.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  current.count += 1;
  return { ok: true };
}

/** Reset helper for unit tests. */
export function resetRateLimitStore() {
  buckets.clear();
}

const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_IP_LIMIT = 8;
const AUTH_EMAIL_LIMIT = 8;

export function sensitiveRateLimit(
  segments: string[],
  method: string,
): RateWindow | null {
  const path = segments.join("/");
  const verb = method.toUpperCase();

  if (path === "api/auth/login" && verb === "POST") {
    return { key: "auth-login", limit: AUTH_IP_LIMIT, windowMs: AUTH_WINDOW_MS };
  }
  if (path === "api/auth/token" && verb === "POST") {
    return { key: "auth-token", limit: AUTH_IP_LIMIT, windowMs: AUTH_WINDOW_MS };
  }
  if (path === "api/auth/refresh" && verb === "POST") {
    return { key: "auth-refresh", limit: 20, windowMs: AUTH_WINDOW_MS };
  }
  if (path === "api/auth/connect" || path.startsWith("api/auth/connect/")) {
    return { key: "auth-connect", limit: 30, windowMs: AUTH_WINDOW_MS };
  }
  if (path === "api/auth/signup" && verb === "POST") {
    return { key: "auth-signup", limit: AUTH_IP_LIMIT, windowMs: AUTH_WINDOW_MS };
  }
  if (path === "api/auth/me" && verb === "PATCH") {
    return { key: "account", limit: AUTH_IP_LIMIT, windowMs: AUTH_WINDOW_MS };
  }
  if (path === "api/auth/google" || path === "api/auth/google/callback") {
    return { key: "auth-google", limit: 30, windowMs: AUTH_WINDOW_MS };
  }
  if (path === "api/billing/checkout" && verb === "POST") {
    return { key: "checkout", limit: 8, windowMs: 10 * 60 * 1000 };
  }
  if (path === "api/billing/support" && verb === "POST") {
    return { key: "support", limit: 8, windowMs: 10 * 60 * 1000 };
  }
  if (path === "api/support" && verb === "POST") {
    return { key: "helpdesk-create", limit: 8, windowMs: 10 * 60 * 1000 };
  }
  if (path.startsWith("api/support/") && verb === "POST") {
    return { key: "helpdesk-write", limit: 20, windowMs: 10 * 60 * 1000 };
  }
  if (path === "api/support" || path.startsWith("api/support/")) {
    return { key: "helpdesk", limit: 60, windowMs: 60 * 1000 };
  }
  if (path === "api/cinem-ai-assistant/usage") {
    return { key: "assistant-usage", limit: 60, windowMs: 60 * 1000 };
  }
  if (path === "api/guest/chat" && verb === "POST") {
    return { key: "guest-chat", limit: 40, windowMs: 60 * 1000 };
  }
  if (path === "api/device/claim" && verb === "POST") {
    return { key: "device-claim", limit: 12, windowMs: AUTH_WINDOW_MS };
  }
  if (path.startsWith("api/device/") && (verb === "POST" || verb === "GET")) {
    return { key: "device", limit: 120, windowMs: 60 * 1000 };
  }
  if (path === "api/admin/backup") {
    return { key: "admin-backup", limit: 8, windowMs: 10 * 60 * 1000 };
  }
  if (path === "api/admin" || path.startsWith("api/admin/")) {
    if (verb === "POST" || verb === "PUT" || verb === "PATCH" || verb === "DELETE") {
      return { key: "admin-write", limit: 20, windowMs: 60 * 1000 };
    }
    return { key: "admin", limit: 60, windowMs: 60 * 1000 };
  }
  if (path.startsWith("api/invites/") && verb === "POST") {
    return { key: "invite", limit: 10, windowMs: AUTH_WINDOW_MS };
  }
  return null;
}

function throwIfLimited(hit: { ok: true } | { ok: false; retryAfterSec: number }) {
  if (!hit.ok) {
    throw new ApiRateLimitError(
      "Too many attempts. Try again in a minute.",
      hit.retryAfterSec,
    );
  }
}

async function enforceAuthEmailRateLimit(
  request: Request,
  segments: string[],
  method: string,
) {
  const path = segments.join("/");
  if (
    (path !== "api/auth/login" &&
      path !== "api/auth/signup" &&
      path !== "api/auth/token") ||
    method.toUpperCase() !== "POST"
  ) {
    return;
  }
  let email = "";
  try {
    const body = (await request.clone().json()) as { email?: unknown };
    if (typeof body.email === "string") email = body.email.trim().toLowerCase();
  } catch {
    return;
  }
  if (!email) return;
  throwIfLimited(
    takeToken(`auth-email:${path}:${email}`, AUTH_EMAIL_LIMIT, AUTH_WINDOW_MS),
  );
}

export async function enforceSensitiveRateLimit(
  request: Request,
  segments: string[],
  method: string,
) {
  const spec = sensitiveRateLimit(segments, method);
  if (spec) {
    const ip = clientIp(request);
    throwIfLimited(takeToken(`${spec.key}:${ip}`, spec.limit, spec.windowMs));
  }
  await enforceAuthEmailRateLimit(request, segments, method);
}
