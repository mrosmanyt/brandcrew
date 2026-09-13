"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  HELPDESK_GUEST_STORAGE_KEY,
  isHelpdeskAdminHiddenPath,
  type HelpdeskThreadDTO,
  type HelpdeskViewer,
} from "@/lib/helpdesk-pure";
import { HONEYPOT_FIELD } from "@/lib/site";
import { cn } from "@/lib/utils";

type SupportPayload = {
  viewer?: HelpdeskViewer;
  founderAvailable?: boolean;
  threads?: HelpdeskThreadDTO[];
  thread?: HelpdeskThreadDTO;
  error?: string;
};

function readGuestKey() {
  try {
    return window.localStorage.getItem(HELPDESK_GUEST_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function writeGuestKey(key: string) {
  try {
    if (key) window.localStorage.setItem(HELPDESK_GUEST_STORAGE_KEY, key);
  } catch {
    /* private mode */
  }
}

function helpHeaders(): HeadersInit {
  const key = readGuestKey();
  return key ? { "x-cinem-help-key": key } : {};
}

async function readJson<T>(res: Response): Promise<T> {
  const payload = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(payload.error || "Could not reach CINEM Help.");
  return payload;
}

function statusLabel(status: string) {
  if (status === "live") return "Live";
  if (status === "replied") return "Replied";
  if (status === "closed") return "Closed";
  return "Open";
}

function roleLabel(role: string) {
  if (role === "founder") return "CINEM team";
  if (role === "ai") return "CINEM Help";
  return "You";
}

export function HelpWidgetHost() {
  const pathname = usePathname() || "";
  if (isHelpdeskAdminHiddenPath(pathname)) return null;
  return <HelpWidget />;
}

export function HelpWidget() {
  const pathname = usePathname() || "";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [founderAvailable, setFounderAvailable] = useState(false);
  const [viewer, setViewer] = useState<HelpdeskViewer>({
    signedIn: false,
    email: "",
    name: "",
  });
  const [thread, setThread] = useState<HelpdeskThreadDTO | null>(null);
  const [email, setEmail] = useState("");
  const [draft, setDraft] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [unread, setUnread] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastSeenCount = useRef(0);

  const workspaceId = useMemo(() => {
    const match = pathname.match(/^\/desk\/([^/]+)/);
    return match?.[1] || "";
  }, [pathname]);

  const applyPayload = useCallback((payload: SupportPayload) => {
    if (payload.viewer) setViewer(payload.viewer);
    if (typeof payload.founderAvailable === "boolean") {
      setFounderAvailable(payload.founderAvailable);
    }
    const next = payload.thread || payload.threads?.[0] || null;
    if (next?.guestKey) writeGuestKey(next.guestKey);
    if (next) {
      setThread(next);
      const count = next.messages?.length ?? 0;
      if (!open && count > lastSeenCount.current) {
        const last = next.messages?.[count - 1];
        if (last && last.role !== "user") setUnread(true);
      }
      if (open) lastSeenCount.current = count;
    }
  }, [open]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/support", { headers: helpHeaders() });
    const payload = await readJson<SupportPayload>(res);
    applyPayload(payload);
    if (payload.thread?.id || payload.threads?.[0]?.id) {
      const id = payload.thread?.id || payload.threads?.[0]?.id;
      const detail = await fetch(`/api/support/${id}`, { headers: helpHeaders() });
      applyPayload(await readJson<SupportPayload>(detail));
    }
  }, [applyPayload]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    setUnread(false);
    const tick = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, thread?.liveActive ? 3000 : 6000);
    return () => window.clearInterval(tick);
  }, [open, refresh, thread?.liveActive]);

  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [thread?.messages?.length, open]);

  async function send(extra?: { liveRequested?: boolean }) {
    const message =
      draft.trim() ||
      (extra?.liveRequested && !thread ? "I'd like to talk with the CINEM team live." : "");
    if (!message && !extra?.liveRequested) return;
    if (!viewer.signedIn && !thread && !email.trim()) {
      setError("Enter your email so the team can follow up.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        message: message || undefined,
        liveRequested: extra?.liveRequested,
        pageUrl: typeof window !== "undefined" ? window.location.href : pathname,
        workspaceId: workspaceId || undefined,
        email: viewer.signedIn ? undefined : email.trim() || undefined,
        [HONEYPOT_FIELD]: honeypot,
      };
      const url = thread ? `/api/support/${thread.id}` : "/api/support";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...helpHeaders() },
        body: JSON.stringify(body),
      });
      const payload = await readJson<SupportPayload>(res);
      applyPayload(payload);
      setDraft("");
      lastSeenCount.current = payload.thread?.messages?.length ?? lastSeenCount.current;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-none fixed right-4 bottom-5 z-40 flex flex-col items-end gap-3">
      {open ? (
        <section
          aria-label="CINEM Help"
          className="pointer-events-auto flex h-[min(32rem,calc(100dvh-6.5rem))] w-[min(22.5rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card/95 text-card-foreground shadow-xl backdrop-blur-md"
        >
          <header className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium tracking-tight">CINEM Help</p>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                {founderAvailable
                  ? "A teammate is available for live chat."
                  : "Team is offline — we still take tickets here."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close help"
            >
              <X className="size-4" />
            </button>
          </header>

          <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {!thread?.messages?.length ? (
              <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
                Describe the issue — “I’m seeing this when I…” — and CINEM Help will
                forward it to the team. This is product helpdesk, not the{" "}
                <Link href="/support" className="underline underline-offset-2">
                  Support tip page
                </Link>
                .
              </p>
            ) : (
              thread.messages.map((row) => (
                <article
                  key={row.id}
                  className={cn(
                    "max-w-[92%] rounded-xl px-3 py-2 text-xs leading-5",
                    row.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-muted/70 text-foreground",
                  )}
                >
                  <p className="mb-1 text-[10px] font-medium tracking-wide uppercase opacity-70">
                    {roleLabel(row.role)}
                  </p>
                  <p className="whitespace-pre-wrap">{row.body}</p>
                </article>
              ))
            )}
            {thread ? (
              <p className="px-1 text-[10px] text-muted-foreground">
                {statusLabel(thread.status)}
                {thread.pageUrl ? ` · ${thread.pageUrl}` : ""}
              </p>
            ) : null}
          </div>

          <form
            className="border-t border-border px-3 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <input
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
              name={HONEYPOT_FIELD}
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
            />
            {!viewer.signedIn && !thread ? (
              <Input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Your email"
                className="mb-2 h-8 text-xs"
                autoComplete="email"
              />
            ) : null}
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                thread?.liveActive
                  ? "Message the CINEM team…"
                  : "I’m seeing this issue…"
              }
              rows={3}
              className="min-h-16 text-xs"
            />
            {error ? <p className="mt-1 text-[11px] text-destructive">{error}</p> : null}
            <div className="mt-2 flex items-center justify-between gap-2">
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={busy}
                onClick={() => void send({ liveRequested: true })}
              >
                Request live chat
              </Button>
              <Button type="submit" size="sm" disabled={busy || !draft.trim()}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                Send
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          setUnread(false);
        }}
        className="pointer-events-auto relative flex size-12 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow-lg ring-2 ring-background transition hover:bg-primary/90"
        aria-expanded={open}
        aria-label="Help"
        title="Help"
      >
        <Bot className="size-5" />
        {unread && !open ? (
          <span className="absolute top-0.5 right-0.5 size-2.5 rounded-full bg-chart-2 ring-2 ring-background" />
        ) : null}
      </button>
    </div>
  );
}
