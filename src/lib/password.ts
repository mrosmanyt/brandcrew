import { createHash } from "node:crypto";
import { assertStrongPassword } from "@/lib/password-rules";

export { assertStrongPassword } from "@/lib/password-rules";

/** Parse a Have I Been Pwned range response (k-anonymity, SHA-1 suffix:count). */
export function hibpRangeContainsSuffix(sha1HexUpper: string, rangeBody: string): boolean {
  const suffix = sha1HexUpper.slice(5).toUpperCase();
  if (suffix.length !== 35) return false;
  return rangeBody.split(/\r?\n/).some((line) => {
    const hash = line.split(":")[0]?.trim().toUpperCase();
    return hash === suffix;
  });
}

/**
 * Optional HIBP check. Fail-open on timeout/network so Hobby signup is not
 * bricked if api.pwnedpasswords.com is unreachable. Never sends the password.
 */
export async function assertPasswordNotPwned(password: string): Promise<string | null> {
  try {
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, {
      headers: {
        "Add-Padding": "true",
        "User-Agent": "CINEM-Pro-password-check",
      },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const body = await res.text();
    if (hibpRangeContainsSuffix(sha1, body)) {
      return "This password appears in a known breach. Choose another.";
    }
    return null;
  } catch {
    return null;
  }
}

export async function assertPasswordAllowed(
  password: string,
  email?: string,
): Promise<string | null> {
  return assertStrongPassword(password, email) ?? (await assertPasswordNotPwned(password));
}
