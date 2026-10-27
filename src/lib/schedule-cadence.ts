import { addDays, nextFriday, nextMonday } from "date-fns";

export const SCHEDULE_CADENCES = [
  { id: "weekly_monday", label: "Every Monday 09:00", cron: "0 9 * * 1" },
  { id: "weekly_friday", label: "Every Friday 09:00", cron: "0 9 * * 5" },
  { id: "weekdays", label: "Weekdays 09:00", cron: "0 9 * * 1-5" },
  { id: "daily", label: "Every day 09:00", cron: "0 9 * * *" },
] as const;

export type FixedScheduleCadence = (typeof SCHEDULE_CADENCES)[number]["id"];

/**
 * Beyond the four fixed presets, a cadence can be "interval:<days>" for a
 * custom every-N-days repeat. Encoded in the same `cadence` string column so
 * this needs no schema migration — schedule-cadence.ts is the only place
 * that has to understand the format.
 */
const INTERVAL_CADENCE_RE = /^interval:([1-9][0-9]{0,3})$/;

export type ScheduleCadence = FixedScheduleCadence | `interval:${number}`;

export function isScheduleCadence(value: string): value is ScheduleCadence {
  return SCHEDULE_CADENCES.some((row) => row.id === value) || INTERVAL_CADENCE_RE.test(value);
}

export function intervalCadenceDays(cadence: string): number | null {
  const match = INTERVAL_CADENCE_RE.exec(cadence);
  return match ? Number(match[1]) : null;
}

export function cadenceLabel(id: string) {
  const days = intervalCadenceDays(id);
  if (days) return days === 1 ? "Every day 09:00" : `Every ${days} days 09:00`;
  return SCHEDULE_CADENCES.find((row) => row.id === id)?.label || id;
}

/**
 * Offset (minutes) of an IANA timezone relative to UTC at the given instant.
 * No date-fns-tz dependency — derived from Intl, which already ships in
 * Node/V8. Good enough for a once-a-day scheduler; DST-transition day itself
 * can be off by the transition amount, which is an acceptable tradeoff here.
 */
function zoneOffsetMinutes(timeZone: string, date: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = Object.fromEntries(
      dtf.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
    );
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    return (asUtc - date.getTime()) / 60000;
  } catch {
    return 0;
  }
}

/** 09:00 wall-clock in `timeZone`, expressed as a UTC Date. */
function nineAmInZone(date: Date, timeZone: string): Date {
  const offsetMinutes = zoneOffsetMinutes(timeZone, date);
  const utc = new Date(date.getTime() + offsetMinutes * 60000);
  utc.setUTCHours(9, 0, 0, 0);
  return new Date(utc.getTime() - offsetMinutes * 60000);
}

function startOfDayInZone(date: Date, timeZone: string): Date {
  const offsetMinutes = zoneOffsetMinutes(timeZone, date);
  const utc = new Date(date.getTime() + offsetMinutes * 60000);
  utc.setUTCHours(0, 0, 0, 0);
  return new Date(utc.getTime() - offsetMinutes * 60000);
}

function dayOfWeekInZone(date: Date, timeZone: string): number {
  const offsetMinutes = zoneOffsetMinutes(timeZone, date);
  return new Date(date.getTime() + offsetMinutes * 60000).getUTCDay();
}

/**
 * Next occurrence matching the cadence, 09:00 in `timezone` (IANA name,
 * default UTC — matches the ScheduledJob.timezone column default).
 */
export function computeNextRunAt(
  cadence: ScheduleCadence,
  from = new Date(),
  timezone = "UTC",
): Date {
  const now = from;
  const todayNine = nineAmInZone(now, timezone);
  const dow = dayOfWeekInZone(now, timezone);

  const intervalDays = intervalCadenceDays(cadence);
  if (intervalDays) {
    return now < todayNine ? todayNine : nineAmInZone(addDays(startOfDayInZone(now, timezone), intervalDays), timezone);
  }

  if (cadence === "daily") {
    return now < todayNine ? todayNine : nineAmInZone(addDays(startOfDayInZone(now, timezone), 1), timezone);
  }

  if (cadence === "weekdays") {
    if (dow >= 1 && dow <= 5 && now < todayNine) return todayNine;
    let cursor = addDays(startOfDayInZone(now, timezone), 1);
    while (dayOfWeekInZone(cursor, timezone) === 0 || dayOfWeekInZone(cursor, timezone) === 6) {
      cursor = addDays(cursor, 1);
    }
    return nineAmInZone(cursor, timezone);
  }

  if (cadence === "weekly_monday") {
    if (dow === 1 && now < todayNine) return todayNine;
    return nineAmInZone(nextMonday(now), timezone);
  }

  if (cadence === "weekly_friday") {
    if (dow === 5 && now < todayNine) return todayNine;
    return nineAmInZone(nextFriday(now), timezone);
  }

  return nineAmInZone(addDays(startOfDayInZone(now, timezone), 1), timezone);
}

/** Roughly how far apart two runs of this cadence should be, in ms. Used to flag overdue schedules. */
export function cadenceIntervalMs(cadence: string): number {
  const days = intervalCadenceDays(cadence);
  if (days) return days * 86_400_000;
  if (cadence === "daily") return 86_400_000;
  if (cadence === "weekdays") return 86_400_000;
  return 7 * 86_400_000;
}

export const SCHEDULE_SERVERLESS_NOTE =
  "Schedules store a cadence and nextRunAt. The runner fires when someone opens the desk (GET /jobs) or hits /api/cron/jobs. Vercel Hobby cron is daily at most — this is not an always-on worker. A schedule can fall behind if nothing hits that endpoint; it catches up on the next hit rather than firing once per missed day.";
