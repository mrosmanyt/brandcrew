import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function secretKey() {
  const raw =
    process.env.SESSION_SECRET || "brandcrew-dev-session-secret-change-me";
  return createHash("sha256").update(raw).digest();
}

/** AES-256-GCM. Returns iv.tag.ciphertext, all base64. Never log the plaintext. */
export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string) {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Stored secret is unreadable.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    secretKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function appOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:43180").replace(
    /\/$/,
    "",
  );
}
