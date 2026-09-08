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

export function sensitiveRateLimit(
  segments: string[],
  method: string,
): RateWindow | null {
  const path = segments.join("/");
  const verb = method.toUpperCase();

  if (
    (path === "api/auth/login" || path === "api/auth/signup") &&
    verb === "POST"
  ) {
    return { key: "auth", limit: 8, windowMs: 15 * 60 * 1000 };
  }
  if (path === "api/auth/google" || path === "api/auth/google/callback") {
    return { key: "auth-google", limit: 30, windowMs: 15 * 60 * 1000 };
  }
  if (path === "api/billing/checkout" && verb === "POST") {
    return { key: "checkout", limit: 8, windowMs: 10 * 60 * 1000 };
  }
  if (path === "api/admin") {
    return { key: "admin", limit: 60, windowMs: 60 * 1000 };
  }
  if (path.startsWith("api/invites/") && verb === "POST") {
    return { key: "invite", limit: 10, windowMs: 15 * 60 * 1000 };
  }
  return null;
}

export function enforceSensitiveRateLimit(
  request: Request,
  segments: string[],
  method: string,
) {
  const spec = sensitiveRateLimit(segments, method);
  if (!spec) return;
  const ip = clientIp(request);
  const hit = takeToken(`${spec.key}:${ip}`, spec.limit, spec.windowMs);
  if (!hit.ok) {
    throw new ApiRateLimitError(
      "Too many attempts. Try again in a minute.",
      hit.retryAfterSec,
    );
  }
}
