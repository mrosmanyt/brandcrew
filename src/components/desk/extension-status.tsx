"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useWorkspaceDevicesPoll,
  type DeviceRow,
} from "@/components/desk/use-workspace-devices-poll";
import { cn } from "@/lib/utils";

export function useExtensionDevices(workspaceId: string) {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useWorkspaceDevicesPoll(workspaceId, (data) => {
    setDevices(data.devices || []);
    setLoaded(true);
  });

  const online = devices.some((device) => device.online);
  const paired = devices.length > 0;
  return { devices, loaded, online, paired };
}

export function ExtensionStatusChip({
  workspaceId,
  compact = false,
}: {
  workspaceId: string;
  compact?: boolean;
}) {
  const { online, paired, loaded } = useExtensionDevices(workspaceId);
  if (!loaded) return null;
  const href = `/desk/${workspaceId}/on-device`;
  const label = online ? "Extension connected" : paired ? "Extension offline" : "Needs extension";
  return (
    <Link
      href={href}
      prefetch={false}
      title={
        online
          ? "Paired to this Chrome — live browser employee is ready."
          : paired
            ? "Chrome is paired but offline. Open the CINEM Pro side panel."
            : "Install the CINEM Pro Chrome extension and Sign in with CINEM."
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] leading-4",
        online
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : paired
            ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
            : "border-border bg-muted/50 text-muted-foreground",
        compact && "px-1.5",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          online ? "bg-emerald-500" : paired ? "bg-amber-400" : "bg-zinc-400",
        )}
      />
      {compact ? (online ? "On" : paired ? "Off" : "Pair") : label}
    </Link>
  );
}
