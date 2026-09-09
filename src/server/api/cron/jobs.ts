import { ClientError, jsonError, jsonOk } from "@/lib/http";
import { runDueSchedules, SCHEDULE_SERVERLESS_NOTE } from "@/lib/schedules";

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    throw new ClientError(
      "CRON_SECRET is not set. Scheduled jobs still enqueue when someone opens Mission Control.",
      401,
      "unauthorized",
    );
  }
  const header = request.headers.get("authorization") || "";
  const bearer = header.replace(/^Bearer\s+/i, "").trim();
  const query = new URL(request.url).searchParams.get("secret") || "";
  if (bearer !== secret && query !== secret) {
    throw new ClientError("Unauthorized cron.", 401, "unauthorized");
  }
}

export async function GET(request: Request) {
  try {
    authorizeCron(request);
    const result = await runDueSchedules();
    const { runDueEventTriggers } = await import("@/lib/event-triggers");
    const triggers = await runDueEventTriggers();
    return jsonOk({ ...result, triggers, note: SCHEDULE_SERVERLESS_NOTE });
  } catch (error) {
    return jsonError(error);
  }
}

export const POST = GET;
