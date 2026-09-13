"use client";

import { useEffect, useRef } from "react";
import {
  deskJobPollIntervalMs,
  workspaceJobsAreLive,
  type WorkspaceJobsPollPayload,
} from "@/lib/desk-poll";

type Listener = (payload: WorkspaceJobsPollPayload) => void;

type Hub = {
  listeners: Set<Listener>;
  timer: ReturnType<typeof setTimeout> | null;
  live: boolean;
  inFlight: boolean;
  onVisible: () => void;
};

const hubs = new Map<string, Hub>();

function pageVisible() {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

function arm(workspaceId: string) {
  const hub = hubs.get(workspaceId);
  if (!hub || hub.listeners.size === 0) return;
  if (hub.timer) {
    clearTimeout(hub.timer);
    hub.timer = null;
  }
  const ms = deskJobPollIntervalMs({
    hasLiveJobs: hub.live,
    visible: pageVisible(),
  });
  if (ms == null) return;
  hub.timer = setTimeout(() => void tick(workspaceId), ms);
}

async function tick(workspaceId: string) {
  const hub = hubs.get(workspaceId);
  if (!hub || hub.listeners.size === 0 || hub.inFlight) return;
  if (!pageVisible()) {
    arm(workspaceId);
    return;
  }
  hub.inFlight = true;
  try {
    const res = await fetch(`/api/workspaces/${workspaceId}/jobs`);
    if (res.ok) {
      const data = (await res.json()) as WorkspaceJobsPollPayload;
      if (Array.isArray(data.jobs)) {
        hub.live = workspaceJobsAreLive(data.jobs);
      }
      for (const listener of hub.listeners) listener(data);
    }
  } finally {
    hub.inFlight = false;
    arm(workspaceId);
  }
}

function ensureHub(workspaceId: string, liveSeed: boolean): Hub {
  let hub = hubs.get(workspaceId);
  if (hub) {
    hub.live = hub.live || liveSeed;
    return hub;
  }
  hub = {
    listeners: new Set(),
    timer: null,
    live: liveSeed,
    inFlight: false,
    onVisible: () => {
      if (pageVisible()) void tick(workspaceId);
      else arm(workspaceId);
    },
  };
  document.addEventListener("visibilitychange", hub.onVisible);
  window.addEventListener("focus", hub.onVisible);
  hubs.set(workspaceId, hub);
  return hub;
}

function releaseHub(workspaceId: string, listener: Listener) {
  const hub = hubs.get(workspaceId);
  if (!hub) return;
  hub.listeners.delete(listener);
  if (hub.listeners.size > 0) return;
  if (hub.timer) clearTimeout(hub.timer);
  document.removeEventListener("visibilitychange", hub.onVisible);
  window.removeEventListener("focus", hub.onVisible);
  hubs.delete(workspaceId);
}

/** Tell the shared loop jobs are live so the next wait uses the active cadence. */
export function reportWorkspaceJobsLive(
  workspaceId: string,
  jobs: { status?: string }[] | undefined | null,
) {
  const hub = hubs.get(workspaceId);
  if (!hub) return;
  hub.live = workspaceJobsAreLive(jobs);
  arm(workspaceId);
}

/**
 * One GET /jobs loop per workspace, shared by sidebar, mission control, and the bell.
 * Idle → 20s; live jobs → 4s; hidden tab → pause until focus.
 */
export function useWorkspaceJobsPoll(
  workspaceId: string,
  onPayload: Listener,
  liveSeed = false,
) {
  const onPayloadRef = useRef(onPayload);
  useEffect(() => {
    onPayloadRef.current = onPayload;
  });

  useEffect(() => {
    const listener: Listener = (payload) => onPayloadRef.current(payload);
    const hub = ensureHub(workspaceId, liveSeed);
    hub.listeners.add(listener);
    if (hub.listeners.size === 1) {
      void tick(workspaceId);
    }
    return () => releaseHub(workspaceId, listener);
    // liveSeed is a first-subscriber hint only; do not restart the shared loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);
}
