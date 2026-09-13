/**
 * Usage metering — fire-and-forget reporter used across the app.
 * Events land in the Admin Panel → Usage & Billing (per-user, per-month).
 *
 * kinds: command · gemini (q1=tokens in, q2=tokens out) · tts (q1=chars)
 *        vision · browser · agent
 */
import { logUsage, type UsageKind } from "@/lib/db";

export function reportUsage(kind: UsageKind, q1 = 1, q2 = 0): void {
  void logUsage(kind, q1, q2);
}
