"use client";

import { useEffect, useRef } from "react";
import { deskDevicePollIntervalMs } from "@/lib/desk-poll";

export type DeviceRow = {
  id: string;
  name: string;
  online: boolean;
  status: string;
  lastSeenAt: string | null;
};

type DevicesPayload = { devices?: DeviceRow[] };
type Listener = (payload: DevicesPayload) => void;

type Hub = {
  listeners: Set<Listener>;
  timer: ReturnType<typeof setTimeout> | null;
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
  const ms = deskDevicePollIntervalMs({ visible: pageVisible() });
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
    const res = await fetch(`/api/workspaces/${workspaceId}/devices`);
    if (res.ok) {
      const data = (await res.json()) as DevicesPayload;
      for (const listener of hub.listeners) listener(data);
    }
  } finally {
    hub.inFlight = false;
    arm(workspaceId);
  }
}

function ensureHub(workspaceId: string): Hub {
  let hub = hubs.get(workspaceId);
  if (hub) return hub;
  hub = {
    listeners: new Set(),
    timer: null,
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

/** One GET /devices loop per workspace (sidebar chips share it). Hidden tabs pause. */
export function useWorkspaceDevicesPoll(workspaceId: string, onPayload: Listener) {
  const onPayloadRef = useRef(onPayload);
  useEffect(() => {
    onPayloadRef.current = onPayload;
  });

  useEffect(() => {
    const listener: Listener = (payload) => onPayloadRef.current(payload);
    const hub = ensureHub(workspaceId);
    hub.listeners.add(listener);
    if (hub.listeners.size === 1) {
      void tick(workspaceId);
    }
    return () => releaseHub(workspaceId, listener);
  }, [workspaceId]);
}
