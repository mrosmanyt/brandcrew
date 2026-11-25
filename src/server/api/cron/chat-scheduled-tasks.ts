import { NextResponse } from "next/server";
import { runDueChatScheduledTasks } from "@/lib/chat-scheduled-tasks";

/**
 * GET|POST /api/cron/chat-scheduled-tasks — Vercel Cron entry point for
 * chat scheduled tasks (Package 9). Follows the standard Vercel cron-auth
 * pattern: Vercel sends `Authorization: Bearer ${CRON_SECRET}` when the
 * CRON_SECRET env var is set. Without a configured secret the route
 * refuses to run, so it can never be triggered anonymously.
 *
 * Deploy-time requirements (merge step): set CRON_SECRET in the Vercel
 * project env and keep the matching cron entry in vercel.json.
 *
 * The vercel.json entry fires once daily (00:00 UTC) because the project
 * is on the Vercel Hobby plan, which rejects sub-daily cron expressions
 * at deploy time. Due tasks catch up on that daily hit; on a Pro plan the
 * schedule can be raised (e.g. hourly) with no code change.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() || "";
  if (!secret) {
    return NextResponse.json(
      { error: "Cron is not configured (CRON_SECRET is not set).", code: "cron_not_configured" },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const summary = await runDueChatScheduledTasks(10);
  return NextResponse.json({ ok: true, ...summary });
}

export const GET = handle;
export const POST = handle;
