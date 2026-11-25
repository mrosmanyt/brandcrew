"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { AdminSafetyAlertsPayload } from "@/lib/admin";
import {
  SAFETY_CATEGORIES,
  SAFETY_CATEGORY_LABELS,
  type SafetyCategory,
} from "@/lib/safety-moderation";
import { AdminPageFrame, fetchAdminJson, postAdmin } from "@/components/admin/admin-shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["", "NEW", "REVIEWED", "DISMISSED"] as const;
const REPEAT_OFFENDER_THRESHOLD = 3;

function severityClass(severity: string) {
  if (severity === "critical") return "bg-red-600 text-white";
  if (severity === "high") return "bg-destructive/15 text-destructive";
  return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
}

function statusClass(status: string) {
  if (status === "NEW") return "bg-red-600 text-white";
  if (status === "REVIEWED") return "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400";
  return "bg-muted text-muted-foreground";
}

export function AdminSafetyAlerts({ initial }: { initial: AdminSafetyAlertsPayload }) {
  const [data, setData] = useState(initial);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  async function refresh(nextStatus = status, nextCategory = category) {
    setBusy(true);
    try {
      const params = new URLSearchParams({ section: "safetyalerts" });
      if (nextStatus) params.set("status", nextStatus);
      if (nextCategory) params.set("category", nextCategory);
      setData(await fetchAdminJson<AdminSafetyAlertsPayload>(`/api/admin?${params}`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load safety alerts.");
    } finally {
      setBusy(false);
    }
  }

  async function setAlertStatus(id: string, next: "REVIEWED" | "DISMISSED") {
    setActingId(id);
    try {
      await postAdmin({ action: "safety_alert_status", alertId: id, alertStatus: next });
      toast.success(next === "REVIEWED" ? "Alert marked reviewed." : "Alert dismissed.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Admin action failed.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <AdminPageFrame
      kicker="Internal Admin HQ"
      title="Safety alerts"
      hint="Chat messages the safety filter refused before they reached a model — who tried, what they tried, and when. Most recent 200."
      actions={
        <Button size="sm" variant="secondary" onClick={() => void refresh()} disabled={busy}>
          {busy ? "Refreshing…" : "Refresh"}
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs"
          value={status}
          aria-label="Filter by status"
          onChange={(event) => {
            setStatus(event.target.value);
            void refresh(event.target.value, category);
          }}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option || "all"} value={option}>
              {option ? `Status: ${option}` : "All statuses"}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs"
          value={category}
          aria-label="Filter by category"
          onChange={(event) => {
            setCategory(event.target.value);
            void refresh(status, event.target.value);
          }}
        >
          <option value="">All categories</option>
          {SAFETY_CATEGORIES.map((key) => (
            <option key={key} value={key}>
              {SAFETY_CATEGORY_LABELS[key as SafetyCategory]}
            </option>
          ))}
        </select>
        {data.newCount > 0 ? (
          <span className="rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white">
            {data.newCount} new
          </span>
        ) : null}
      </div>

      {data.alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No safety alerts match.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[72rem] text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">User</th>
                <th className="p-3">Category</th>
                <th className="p-3">Severity</th>
                <th className="p-3">What they tried</th>
                <th className="p-3">Alerts</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.alerts.map((row) => {
                const repeat = row.identityAlertTotal >= REPEAT_OFFENDER_THRESHOLD;
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border/60 align-top",
                      repeat && "bg-red-500/5",
                    )}
                  >
                    <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">
                      {row.userEmail ? (
                        <>
                          <p className="text-xs font-medium">{row.userEmail}</p>
                          {row.userName ? (
                            <p className="text-[11px] text-muted-foreground">{row.userName}</p>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-medium">Guest</p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {row.guestId ? `${row.guestId.slice(0, 8)}…` : "—"}
                            {row.ipAddress ? ` · ${row.ipAddress}` : ""}
                          </p>
                        </>
                      )}
                    </td>
                    <td className="p-3 text-xs">
                      {SAFETY_CATEGORY_LABELS[row.category as SafetyCategory] ?? row.category}
                    </td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
                          severityClass(row.severity),
                        )}
                      >
                        {row.severity}
                      </span>
                    </td>
                    <td className="max-w-md p-3 text-xs break-words whitespace-pre-wrap">
                      {row.excerpt}
                      {row.signals ? (
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {row.signals}
                        </span>
                      ) : null}
                    </td>
                    <td className="p-3">
                      {repeat ? (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white">
                          ⚠ Repeat · {row.identityAlertTotal}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {row.identityAlertTotal}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          statusClass(row.status),
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actingId === row.id || row.status === "REVIEWED"}
                          onClick={() => void setAlertStatus(row.id, "REVIEWED")}
                        >
                          Reviewed
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={actingId === row.id || row.status === "DISMISSED"}
                          onClick={() => void setAlertStatus(row.id, "DISMISSED")}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageFrame>
  );
}
