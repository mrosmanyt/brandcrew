import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

// Mock mode me ek fixed dev key use hoti hai taake bina .env ke test chale.
const keyHex = config.tokenEncKey && config.tokenEncKey.length === 64
  ? config.tokenEncKey
  : "d".repeat(64);
const KEY = Buffer.from(keyHex, "hex");

/** OAuth refresh tokens DB me kabhi plain text nahi jaate — AES-256-GCM. */
export function encrypt(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return `${iv.toString("hex")}.${cipher.getAuthTag().toString("hex")}.${enc.toString("hex")}`;
}

export function decrypt(blob) {
  const [ivH, tagH, dataH] = String(blob).split(".");
  const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivH, "hex"));
  decipher.setAuthTag(Buffer.from(tagH, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataH, "hex")), decipher.final()]).toString("utf8");
}

/** OAuth `state` — signed, expiring. CSRF se bachata hai. */
export function signState(userId, ttlMs = 10 * 60 * 1000) {
  const payload = `${userId}.${Date.now() + ttlMs}`;
  const sig = createHmac("sha256", KEY).update(payload).digest("hex").slice(0, 32);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyState(state) {
  try {
    const raw = Buffer.from(String(state), "base64url").toString("utf8");
    const i = raw.lastIndexOf(".");
    const payload = raw.slice(0, i);
    const sig = raw.slice(i + 1);
    const expect = createHmac("sha256", KEY).update(payload).digest("hex").slice(0, 32);
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
    const [userId, expStr] = payload.split(".");
    if (Date.now() > Number(expStr)) return null;
    return userId;
  } catch {
    return null;
  }
}
