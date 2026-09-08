import { HONEYPOT_FIELD } from "@/lib/site";

export function honeypotFilled(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const value = (body as Record<string, unknown>)[HONEYPOT_FIELD];
  return typeof value === "string" && value.trim().length > 0;
}

export function validateLoginInput(email: string, password: string): string | null {
  if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Enter a valid email.";
  }
  if (!password) return "Enter your password.";
  return null;
}

export function validateSignupInput(
  name: string,
  email: string,
  password: string,
): string | null {
  if (!name.trim()) return "Enter your name.";
  if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Enter a valid email.";
  }
  if (password.length < 8) return "Password must be at least 8 characters.";
  return null;
}
