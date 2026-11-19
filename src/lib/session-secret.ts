/**
 * Single source of truth for the SESSION_SECRET.
 *
 * In production the secret MUST come from the environment: it signs session
 * JWTs and derives the AES-256-GCM vault key for stored BYOK/plugin secrets,
 * so falling back to a known string would compromise both. Fail closed.
 * Outside production a dev-only fallback keeps local dev and check scripts
 * working without setup.
 */
export function sessionSecret(): string {
  const raw = process.env.SESSION_SECRET;
  if (raw) return raw;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is not set. Refusing to start in production without it: " +
        "it signs session tokens and protects stored API keys.",
    );
  }
  return "brandcrew-dev-session-secret-change-me";
}

export function sessionSecretBytes(): Uint8Array {
  return new TextEncoder().encode(sessionSecret());
}
