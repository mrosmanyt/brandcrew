/**
 * SafetyAlert writes (owner directive, 2026-11-25).
 *
 * `recordSafetyAlert` is the write path used by the chat surfaces when
 * src/lib/safety-moderation.ts refuses a message. It is deliberately
 * best-effort: callers wrap it so a logging failure can never break or
 * block the chat itself — the refusal still goes out, the model is
 * still never called.
 *
 * Admin-side reads/mutations live in src/lib/admin.ts
 * (getAdminSafetyAlerts / adminSetSafetyAlertStatus /
 * countNewSafetyAlerts), next to the other Admin HQ loaders.
 */
import { prisma } from "@/lib/db";
import type { SafetyVerdict } from "@/lib/safety-moderation";

export const SAFETY_EXCERPT_MAX = 300;

export async function recordSafetyAlert(input: {
  verdict: SafetyVerdict;
  message: string;
  userId?: string | null;
  userEmail?: string | null;
  guestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  if (!input.verdict.flagged || !input.verdict.category || !input.verdict.severity) {
    return;
  }
  await prisma.safetyAlert.create({
    data: {
      userId: input.userId ?? null,
      userEmail: input.userEmail ?? null,
      guestId: input.guestId ?? null,
      category: input.verdict.category,
      severity: input.verdict.severity,
      score: input.verdict.score,
      signals: input.verdict.matchedSignals.join("; ").slice(0, 1000),
      excerpt: input.message.trim().slice(0, SAFETY_EXCERPT_MAX),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      status: "NEW",
    },
  });
}
