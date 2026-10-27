/** Client-safe password rules (no Node crypto). Server also runs HIBP. */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

const TRIVIAL_PASSWORDS = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "password1234",
  "passw0rd",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty",
  "qwerty12",
  "qwerty123",
  "qwertyui",
  "qwertyuiop",
  "asdfghjk",
  "letmein",
  "welcome",
  "welcome1",
  "iloveyou",
  "admin",
  "admin123",
  "abc12345",
  "abc123456",
  "monkey12",
  "dragon12",
  "baseball",
  "football",
  "sunshine",
  "princess",
  "brandcrew",
  "brandcrew1",
  "cinempro",
  "cinempro1",
  "cinem123",
  "cinem1234",
]);

export function assertStrongPassword(password: string, email?: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return "Password is too long.";
  }
  const lower = password.toLowerCase();
  if (TRIVIAL_PASSWORDS.has(lower)) {
    return "That password is too common. Choose another.";
  }
  if (/^(.)\1+$/.test(password)) {
    return "Don't use a single repeated character.";
  }
  const local = email?.split("@")[0]?.trim().toLowerCase() ?? "";
  if (local.length >= 4 && lower.includes(local)) {
    return "Don't include your email in the password.";
  }
  return null;
}
