import { addDays, nextFriday, nextMonday } from "date-fns";

export const SCHEDULE_CADENCES = [
  { id: "weekly_monday", label: "Every Monday 09:00 UTC", cron: "0 9 * * 1" },
  { id: "weekly_friday", label: "Every Friday 09:00 UTC", cron: "0 9 * * 5" },
  { id: "weekdays", label: "Weekdays 09:00 UTC", cron: "0 9 * * 1-5" },
  { id: "daily", label: "Every day 09:00 UTC", cron: "0 9 * * *" },
] as const;

export type ScheduleCadence = (typeof SCHEDULE_CADENCES)[number]["id"];

export function isScheduleCadence(value: string): value is ScheduleCadence {
  return SCHEDULE_CADENCES.some((row) => row.id === value);
}

export function cadenceLabel(id: string) {
  return SCHEDULE_CADENCES.find((row) => row.id === id)?.label || id;
}

function atNineUtc(date: Date) {
  const utc = new Date(date);
  utc.setUTCHours(9, 0, 0, 0);
  return utc;
}

function startOfUtcDay(date: Date) {
  const utc = new Date(date);
  utc.setUTCHours(0, 0, 0, 0);
  return utc;
}

/** Next 09:00 UTC matching the cadence. Timezone is UTC — serverless has no always-on clock. */
export function computeNextRunAt(cadence: ScheduleCadence, from = new Date()): Date {
  const now = from;
  const todayNine = atNineUtc(now);
  const dow = now.getUTCDay();

  if (cadence === "daily") {
    return now < todayNine ? todayNine : atNineUtc(addDays(startOfUtcDay(now), 1));
  }

  if (cadence === "weekdays") {
    if (dow >= 1 && dow <= 5 && now < todayNine) return todayNine;
    let cursor = addDays(startOfUtcDay(now), 1);
    while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) {
      cursor = addDays(cursor, 1);
    }
    return atNineUtc(cursor);
  }

  if (cadence === "weekly_monday") {
    if (dow === 1 && now < todayNine) return todayNine;
    return atNineUtc(nextMonday(now));
  }

  if (cadence === "weekly_friday") {
    if (dow === 5 && now < todayNine) return todayNine;
    return atNineUtc(nextFriday(now));
  }

  return atNineUtc(addDays(startOfUtcDay(now), 1));
}

export const SCHEDULE_SERVERLESS_NOTE =
  "Schedules store a cadence and nextRunAt. The runner fires when someone opens the desk (GET /jobs) or hits /api/cron/jobs. Vercel Hobby cron is daily at most — this is not an always-on worker.";
