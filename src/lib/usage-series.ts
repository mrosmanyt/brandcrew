/** Daily credit/token series from UsageEvent rows. Credits wrap tokens 1:1. */

export type UsageLedgerSource = "usage_event" | "job" | "credit_ledger";

export type UsageDayPoint = {
  date: string;
  tokens: number;
  credits: number;
  events: number;
  jobs: number;
};

export type UsageModelSlice = {
  model: string;
  tokens: number;
  credits: number;
  events: number;
};

export type UsageSeriesMeta = {
  days: number;
  source: UsageLedgerSource;
  note: string;
};

function utcDayKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function eachUtcDay(days: number, now: Date) {
  const keys: string[] = [];
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let i = days - 1; i >= 0; i--) {
    keys.push(new Date(end - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  }
  return keys;
}

export function emptyUsageSeries(days: number, now = new Date()): UsageDayPoint[] {
  return eachUtcDay(days, now).map((date) => ({
    date,
    tokens: 0,
    credits: 0,
    events: 0,
    jobs: 0,
  }));
}

export function aggregateUsageSeries(input: {
  days: number;
  now?: Date;
  events?: { tokens: number; createdAt: Date | string }[];
  jobs?: { createdAt: Date | string }[];
}): UsageDayPoint[] {
  const days = Math.max(1, Math.min(90, Math.floor(input.days) || 30));
  const now = input.now ?? new Date();
  const byDay = new Map(emptyUsageSeries(days, now).map((row) => [row.date, { ...row }]));

  for (const event of input.events || []) {
    const key = utcDayKey(event.createdAt);
    const row = key ? byDay.get(key) : undefined;
    if (!row) continue;
    const tokens = Math.max(0, Math.floor(event.tokens) || 0);
    row.tokens += tokens;
    row.credits += tokens;
    row.events += 1;
  }

  for (const job of input.jobs || []) {
    const key = utcDayKey(job.createdAt);
    const row = key ? byDay.get(key) : undefined;
    if (!row) continue;
    row.jobs += 1;
  }

  return [...byDay.values()];
}

export function aggregateUsageByModel(
  events: { tokens: number; model?: string | null }[],
): UsageModelSlice[] {
  const map = new Map<string, UsageModelSlice>();
  for (const event of events) {
    const model = event.model?.trim() || "unknown";
    const tokens = Math.max(0, Math.floor(event.tokens) || 0);
    const row = map.get(model) || { model, tokens: 0, credits: 0, events: 0 };
    row.tokens += tokens;
    row.credits += tokens;
    row.events += 1;
    map.set(model, row);
  }
  return [...map.values()].sort((a, b) => b.tokens - a.tokens);
}

export function usageSeriesMeta(input: {
  eventCount: number;
  jobCount: number;
  tokenUsed: number;
}): UsageSeriesMeta {
  if (input.eventCount > 0) {
    return {
      days: 0,
      source: "usage_event",
      note: "Daily bars are summed from UsageEvent rows (credits = tokens 1:1). Remaining caps come from the workspace credit ledger.",
    };
  }
  if (input.jobCount > 0) {
    return {
      days: 0,
      source: "job",
      note: "No token events in this window. The job line is counted from Job rows. Remaining credits still come from the workspace ledger — we do not invent a daily token split.",
    };
  }
  return {
    days: 0,
    source: "credit_ledger",
    note: "No usage events or jobs in this window. Remaining credits are the live workspace cap (token budget 1:1).",
  };
}

export function seriesTotals(series: UsageDayPoint[]) {
  return series.reduce(
    (acc, row) => {
      acc.tokens += row.tokens;
      acc.credits += row.credits;
      acc.events += row.events;
      acc.jobs += row.jobs;
      return acc;
    },
    { tokens: 0, credits: 0, events: 0, jobs: 0 },
  );
}
