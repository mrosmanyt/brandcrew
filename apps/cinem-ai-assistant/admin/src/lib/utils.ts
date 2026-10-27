import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats an ISO date as a short readable string. */
export const fmtDate = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) : "—";

/** Generates a license key: CINEM-AI-ASSISTANT-XXXX-XXXX-XXXX-XXXX (crypto random). */
export function generateLicenseKey(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  const block = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map((b) => alphabet[b % alphabet.length])
      .join("");
  return `CINEM-AI-ASSISTANT-${block()}-${block()}-${block()}-${block()}`;
}
