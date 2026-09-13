import "dotenv/config";
import path from "node:path";

const bool = (v) => v === "1" || v === "true";

export const config = {
  port: Number(process.env.PORT || 8787),
  publicUrl: (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 8787}`).replace(/\/$/, ""),
  mock: bool(process.env.CINEM-AI-ASSISTANT_MOCK || "0"),

  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",

  redisUrl: process.env.REDIS_URL || "",

  tokenEncKey: process.env.TOKEN_ENC_KEY || "",

  geminiKey: process.env.GEMINI_API_KEY || "",
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  models: {
    fast: process.env.MODEL_FAST || "gemini-2.0-flash",
    mid: process.env.MODEL_MID || "claude-sonnet-4-5",
    best: process.env.MODEL_BEST || "claude-opus-4-1",
  },

  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",

  telegramToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramSecret: process.env.TELEGRAM_WEBHOOK_SECRET || "",

  videoProvider: process.env.VIDEO_PROVIDER || "none",

  storageDir: path.resolve(process.env.STORAGE_DIR || "./storage"),
  ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg",
};

/** Production start par zaroori cheezein check karo — clear error, silent fail nahi. */
export function validateConfig() {
  if (config.mock) return []; // mock mode: kuch zaroori nahi
  const missing = [];
  if (!config.supabaseUrl) missing.push("SUPABASE_URL");
  if (!config.supabaseServiceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!config.tokenEncKey || config.tokenEncKey.length !== 64)
    missing.push("TOKEN_ENC_KEY (32-byte hex — `npm run genkey`)");
  if (!config.googleClientId || !config.googleClientSecret)
    missing.push("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (YouTube connect ke liye)");
  if (!config.geminiKey && !config.anthropicKey)
    missing.push("GEMINI_API_KEY ya ANTHROPIC_API_KEY (kam az kam ek)");
  return missing;
}
