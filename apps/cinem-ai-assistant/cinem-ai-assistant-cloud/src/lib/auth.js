import { randomBytes } from "node:crypto";
import { config } from "../config.js";
import { supa } from "./db.js";

/**
 * Auth middleware.
 *  - Real: `Authorization: Bearer <supabase access token>` — website/desktop/
 *    Telegram sab isi se aayenge (Supabase auth already project me hai).
 *  - Mock: `x-cinem-ai-assistant-user` header (default "demo-user") — local testing.
 *  - Internal: Telegram webhook jaise server-side flows ke liye ek
 *    process-lifetime random key (bahar se forge nahi ho sakti).
 */
const INTERNAL_KEY = randomBytes(24).toString("hex");
export function internalKey() { return INTERNAL_KEY; }

export async function requireAuth(req, res, next) {
  try {
    // Internal server-to-self call (Telegram bot) — user pehle hi linked/verified
    if (req.headers["x-cinem-ai-assistant-internal"] === INTERNAL_KEY && req.headers["x-cinem-ai-assistant-user-internal"]) {
      req.userId = String(req.headers["x-cinem-ai-assistant-user-internal"]);
      return next();
    }

    if (config.mock) {
      req.userId = String(req.headers["x-cinem-ai-assistant-user"] || "demo-user");
      return next();
    }

    const header = String(req.headers.authorization || "");
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Login required (Bearer token missing)" });

    const { data, error } = await supa().auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Session invalid ya expire — dobara login karein" });
    req.userId = data.user.id;
    req.userEmail = data.user.email || null;
    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/** Chhota in-memory rate limiter — brute force / runaway clients ke liye. */
const hits = new Map();
export function rateLimit(maxPerMin = 60) {
  return (req, res, next) => {
    const key = req.userId || req.ip;
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < 60_000);
    if (arr.length >= maxPerMin) return res.status(429).json({ error: "Thoda aaram se — rate limit hit ho gayi" });
    arr.push(now);
    hits.set(key, arr);
    next();
  };
}
