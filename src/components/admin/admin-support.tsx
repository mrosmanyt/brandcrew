"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminPageFrame, SimpleConfirm, fetchAdminJson, postJson } from "@/components/admin/admin-shared";
import type { HelpdeskInbox, HelpdeskThreadDTO } from "@/lib/helpdesk-pure";
import { cn } from "@/lib/utils";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function statusTone(status: string) {
  if (status === "live") return "text-chart-2";
  if (status === "closed") return "text-muted-foreground";
  if (status === "replied") return "text-foreground";
  return "text-amber-600 dark:text-amber-400";
}

export function AdminSupport({ initial }: { initial: HelpdeskInbox }) {
  const [inbox, setInbox] = useState(initial);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState(initial.threads[0]?.id || "");
  const [thread, setThread] = useState<HelpdeskThreadDTO | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingClose, setPendingClose] = useState<"close" | "reopen" | null>(null);

  const selected = useMemo(
    () => inbox.threads.find((row) => row.id === selectedId) || null,
    [inbox.threads, selectedId],
  );

  async function loadInbox() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status !== "all") params.set("status", status);
    const next = await fetchAdminJson<HelpdeskInbox>(
      `/api/admin/support?${params.toString()}`,
    );
    setInbox(next);
    if (selectedId && !next.threads.some((row) => row.id === selectedId)) {
      setSelectedId(next.threads[0]?.id || "");
    }
  }

  async function loadThread(id: string) {
    if (!id) {
      setThread(null);
      return;
    }
    const payload = await fetchAdminJson<{ thread: HelpdeskThreadDTO }>(
      `/api/admin/support/${id}`,
    );
    setThread(payload.thread);
  }

  async function heartbeat() {
    await postJson("/api/admin/support", { action: "presence" });
  }

  useEffect(() => {
    // Polling every 5s from a backgrounded tab wastes founder-admin API
    // budget and keeps "presence" (live support) stuck on indefinitely —
    // pause while the tab is hidden, catch up once it's visible again.
    function tick() {
      if (document.hidden) return;
      void heartbeat();
      loadInbox().catch(() => undefined);
      if (selectedId) loadThread(selectedId).catch(() => undefined);
    }
    tick();
    const pulse = window.setInterval(tick, 5000);
    function onVisibility() {
      if (!document.hidden) tick();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(pulse);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [selectedId, q, status]);

  useEffect(() => {
    if (selectedId) loadThread(selectedId).catch(() => undefined);
  }, [selectedId]);

  async function act(action: "reply" | "join_live" | "leave_live" | "close" | "reopen") {
    if (!selectedId) return;
    setBusy(true);
    try {
      const payload = await postJson(`/api/admin/support/${selectedId}`, {
        action,
        body: action === "reply" ? reply : undefined,
      });
      setThread(payload.thread as HelpdeskThreadDTO);
      if (action === "reply") setReply("");
      await loadInbox();
      toast.success(
        action === "reply"
          ? "Reply sent."
          : action === "join_live"
            ? "You joined live chat."
            : action === "close"
              ? "Thread closed."
              : "Updated.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
      setPendingClose(null);
    }
  }

  return (
    <AdminPageFrame
      kicker="Internal Admin HQ"
      title="Team support"
      hint="Product helpdesk from the Help widget. Separate from Whop Support tips on Billing. Heartbeat on this page marks you available for live chat."
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Open + live</p>
          <p className="mt-1 text-2xl font-medium tracking-tight">{inbox.open}</p>
        </article>
        <article className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Live now</p>
          <p className="mt-1 text-2xl font-medium tracking-tight">{inbox.live}</p>
        </article>
        <article className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Your presence</p>
          <p className="mt-1 text-sm font-medium">
            {inbox.founderAvailable ? "Available for live chat" : "Offline until this page is open"}
          </p>
        </article>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search email, name, or preview"
          className="h-8 max-w-xs text-xs"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="live">Live</option>
          <option value="replied">Replied</option>
          <option value="closed">Closed</option>
        </select>
        <Button size="sm" variant="outline" onClick={() => void loadInbox()}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          {inbox.threads.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No help threads yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {inbox.threads.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={cn(
                      "w-full px-4 py-3 text-left hover:bg-muted/50",
                      selectedId === row.id && "bg-muted",
                    )}
                  >
                    <p className="truncate text-sm font-medium">{row.email || "Anonymous"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{row.preview || "—"}</p>
                    <p className={cn("mt-1 text-[11px] capitalize", statusTone(row.status))}>
                      {row.status}
                      {row.liveRequested ? " · wants live" : ""}
                      {" · "}
                      {formatWhen(row.lastMessageAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-border bg-card">
          {!selected ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Pick a thread.</p>
          ) : (
            <>
              <header className="border-b border-border px-5 py-4">
                <p className="text-sm font-medium">{selected.email || "No email"}</p>
                <p className="text-xs text-muted-foreground">
                  {selected.name || "—"}
                  {selected.workspaceId ? ` · workspace ${selected.workspaceId}` : ""}
                  {selected.pageUrl ? ` · ${selected.pageUrl}` : ""}
                </p>
                <p className={cn("mt-1 text-xs capitalize", statusTone(thread?.status || selected.status))}>
                  {thread?.status || selected.status}
                  {thread?.liveActive || selected.liveActive ? " · you are in the live thread" : ""}
                </p>
              </header>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
                {(thread?.messages || []).map((row) => (
                  <article key={row.id} className="rounded-xl bg-muted/50 px-3 py-2">
                    <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      {row.role === "founder" ? "You" : row.role === "ai" ? "CINEM Help" : row.authorEmail || "User"}
                      {" · "}
                      {formatWhen(row.createdAt)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{row.body}</p>
                  </article>
                ))}
              </div>
              <div className="border-t border-border px-5 py-4">
                <Textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Reply to the customer…"
                  rows={3}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy || !reply.trim()} onClick={() => void act("reply")}>
                    Send reply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void act(thread?.liveActive ? "leave_live" : "join_live")}
                  >
                    {thread?.liveActive ? "Leave live" : "Join live chat"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setPendingClose(thread?.status === "closed" ? "reopen" : "close")}
                  >
                    {thread?.status === "closed" ? "Reopen" : "Close"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <SimpleConfirm
        open={Boolean(pendingClose)}
        title={pendingClose === "reopen" ? "Reopen this thread?" : "Close this thread?"}
        body={
          pendingClose === "reopen"
            ? "Marks it open again so it shows in Open + live counts."
            : "Marks it closed. The customer can still see the history; reopen any time."
        }
        busy={busy}
        onClose={() => setPendingClose(null)}
        onConfirm={() => pendingClose && void act(pendingClose)}
      />
    </AdminPageFrame>
  );
}
