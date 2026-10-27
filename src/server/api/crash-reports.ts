import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

const MAX_REPORTS_PER_DAY = 200; // crude abuse guard, no auth required to submit

const postSchema = z.object({
  platform: z.string().min(1).max(40),
  appVersion: z.string().min(1).max(40),
  reason: z.string().min(1).max(120),
  detail: z.string().max(4000).optional(),
});

/**
 * Opt-in, self-hosted crash report ingestion — the desktop shell only calls
 * this when the user has turned on crash reporting; see safe-mode.cjs for
 * the local crash-loop counter this is independent of. No third-party
 * subprocessor (Sentry etc.) — stays in the same Postgres as everything
 * else, consistent with the project's DPA/privacy posture.
 */
export async function POST(request: Request) {
  try {
    const body = postSchema.parse(await request.json());
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const countToday = await prisma.crashReport.count({ where: { createdAt: { gte: since } } });
    if (countToday >= MAX_REPORTS_PER_DAY) {
      return NextResponse.json({ error: "Rate limited." }, { status: 429 });
    }

    const user = await getCurrentUser().catch(() => null);
    await prisma.crashReport.create({
      data: {
        userId: user?.id ?? null,
        platform: body.platform,
        appVersion: body.appVersion,
        reason: body.reason,
        detail: (body.detail || "").slice(0, 4000),
      },
    });
    return jsonOk({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "platform, appVersion, and reason are required." }, { status: 400 });
    }
    return jsonError(error);
  }
}
