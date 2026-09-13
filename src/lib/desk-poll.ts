/**
 * Desk poll cadence. Idle desks must not hammer GET /jobs (or /devices).
 * Live statuses keep a modest interval; hidden tabs pause until focus.
 */

export const LIVE_JOB_STATUSES = ["queued", "running", "needs_you"] as const;

export const DESK_JOB_POLL_ACTIVE_MS = 4_000;
export const DESK_JOB_POLL_IDLE_MS = 20_000;
export const DESK_DEVICE_POLL_MS = 30_000;

export type WorkspaceJobsPollPayload = {
  jobs?: {
    id?: string;
    title?: string;
    agentId?: string | null;
    status?: string;
    updatedAt?: string;
  }[];
  skills?: unknown[];
  limits?: {
    tokenUsed?: number;
    tokenBudget?: number;
    jobsThisHour?: number;
    jobsPerHour?: number;
    concurrentJobs?: number;
    maxConcurrentJobs?: number;
    plan?: string;
  };
  employeeStatus?: Record<string, string>;
};

export function workspaceJobsAreLive(
  jobs: { status?: string }[] | undefined | null,
): boolean {
  if (!jobs?.length) return false;
  return jobs.some((job) =>
    LIVE_JOB_STATUSES.includes(job.status as (typeof LIVE_JOB_STATUSES)[number]),
  );
}

/** `null` means do not schedule — wait for visibility/focus. */
export function deskJobPollIntervalMs(input: {
  hasLiveJobs: boolean;
  visible: boolean;
}): number | null {
  if (!input.visible) return null;
  return input.hasLiveJobs ? DESK_JOB_POLL_ACTIVE_MS : DESK_JOB_POLL_IDLE_MS;
}

export function deskDevicePollIntervalMs(input: { visible: boolean }): number | null {
  if (!input.visible) return null;
  return DESK_DEVICE_POLL_MS;
}
