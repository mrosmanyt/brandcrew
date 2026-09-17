"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppWindow,
  ArrowUp,
  ChevronDown,
  Layers,
  Loader2,
  Lock,
  Menu,
  PenLine,
  Plus,
  Smartphone,
  SquareDashedMousePointer,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand/logo";
import { DesktopBuildRequiredDialog } from "@/components/desk/desktop-build-required-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MODEL_ROUTING_GROUPS,
  modelRoutingLabel,
  modelRoutingLocked,
} from "@/lib/agent-modes";
import { BUILD_PROMPT_CATEGORIES } from "@/lib/build-prompt";
import {
  GUEST_CHAT_MESSAGE_LIMIT,
  GUEST_CHAT_MODEL_KEY,
  GUEST_CHAT_STORAGE_KEY,
  type GuestChatMessage,
} from "@/lib/guest-chat-pure";
import {
  normalizeModelRouting,
  type LlmRoutingPreference,
  type LlmStatus,
} from "@/lib/llm-routing";
import { cn } from "@/lib/utils";
import { FoundingSpotsBanner } from "@/components/marketing/founding-spots-banner";

const BUILD_ICONS = {
  website: AppWindow,
  mobile: Smartphone,
  design: SquareDashedMousePointer,
  slides: Layers,
  content: PenLine,
} as const;

const TOP_NAV = [
  { href: "/about#features", label: "Features" },
  { href: "/about#pricing", label: "Pricing" },
  { href: "/download", label: "Download" },
  { href: "/about", label: "About" },
] as const;

function loadGuestKey(): string {
  if (typeof window === "undefined") return "";
  let key = localStorage.getItem(GUEST_CHAT_STORAGE_KEY);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(GUEST_CHAT_STORAGE_KEY, key);
  }
  return key;
}

function loadModelRouting(): LlmRoutingPreference {
  if (typeof window === "undefined") return "auto";
  return normalizeModelRouting(localStorage.getItem(GUEST_CHAT_MODEL_KEY));
}

export function GuestChatHome() {
  const [guestKey, setGuestKey] = useState("");
  const [messages, setMessages] = useState<GuestChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [authRequired, setAuthRequired] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [modelRouting, setModelRouting] = useState<LlmRoutingPreference>("auto");
  const [llm, setLlm] = useState<LlmStatus>({
    openai: false,
    anthropic: false,
    gemini: false,
    xai: false,
    configured: false,
    mode: "demo",
  });
  const [navOpen, setNavOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setGuestKey(loadGuestKey());
    setModelRouting(loadModelRouting());
    void fetch("/api/guest/chat")
      .then((res) => res.json())
      .then((data) => {
        if (data.llm) setLlm(data.llm);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, busy]);

  const remaining = Math.max(0, GUEST_CHAT_MESSAGE_LIMIT - userCount);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      if (authRequired) {
        setAuthOpen(true);
        return;
      }
      setBusy(true);
      try {
        const res = await fetch("/api/guest/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cinem-guest-key": guestKey || loadGuestKey(),
          },
          body: JSON.stringify({
            message,
            guestKey: guestKey || loadGuestKey(),
            modelRouting,
            history: messages.slice(-12),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Could not send that message.");
          return;
        }
        if (data.guestKey) {
          localStorage.setItem(GUEST_CHAT_STORAGE_KEY, data.guestKey);
          setGuestKey(data.guestKey);
        }
        if (Array.isArray(data.messages)) setMessages(data.messages);
        setUserCount(data.userMessageCount ?? userCount + 1);
        if (data.authRequired) {
          setAuthRequired(true);
          setAuthOpen(true);
        }
        setInput("");
      } catch {
        toast.error("Network error. Try again.");
      } finally {
        setBusy(false);
        textareaRef.current?.focus();
      }
    },
    [authRequired, busy, guestKey, messages, modelRouting, userCount],
  );

  function saveModel(next: LlmRoutingPreference) {
    setModelRouting(next);
    localStorage.setItem(GUEST_CHAT_MODEL_KEY, next);
    toast.message(`Using ${modelRoutingLabel(next)}.`);
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label="Open menu"
            onClick={() => setNavOpen(true)}
          >
            <Menu className="size-4" />
          </Button>
          <Link href="/" className="shrink-0">
            <BrandMark />
          </Link>
        </div>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground lg:flex">
          {TOP_NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/login" />}>
            Log in
          </Button>
          <Button size="sm" nativeButton={false} render={<Link href="/signup" />}>
            Sign up
          </Button>
        </div>
      </header>

      <FoundingSpotsBanner className="mx-4 mt-3" />

      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-8">
            {empty ? (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                <h1 className="font-heading text-3xl tracking-tight md:text-4xl">
                  What can I help with?
                </h1>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  Ask anything — CINEM Pro answers instantly. Sign in for the full desk, agents,
                  and approvals.
                </p>
              </div>
            ) : (
              <ul className="space-y-6 pb-4">
                {messages.map((msg) => (
                  <li
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground",
                      )}
                    >
                      {msg.content}
                    </div>
                  </li>
                ))}
                {busy ? (
                  <li className="flex justify-start">
                    <div className="rounded-2xl bg-muted px-4 py-3">
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    </div>
                  </li>
                ) : null}
              </ul>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-background px-4 pb-6 pt-3">
          <form
            className="mx-auto max-w-3xl"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <div className="rounded-[26px] border border-border bg-card shadow-sm">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={3}
                disabled={busy}
                placeholder={
                  authRequired
                    ? "Sign in to continue chatting…"
                    : "Message CINEM Pro…"
                }
                className="min-h-[4.5rem] resize-none border-0 bg-transparent px-4 pt-3.5 pb-2 text-[15px] shadow-none focus-visible:ring-0"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="grid size-8 place-items-center rounded-full bg-muted hover:opacity-80"
                    aria-label="Attach or build"
                  >
                    <Plus className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="start" className="min-w-56">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Build</DropdownMenuLabel>
                      {BUILD_PROMPT_CATEGORIES.map((category) => {
                        const Icon = BUILD_ICONS[category.id];
                        return (
                          <DropdownMenuItem key={category.id} onClick={() => setBuildOpen(true)}>
                            <Icon className="size-4" />
                            {category.label}
                            <Lock className="ml-auto size-3.5 text-muted-foreground" />
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex items-center gap-1.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium hover:opacity-90">
                      {modelRoutingLabel(modelRouting)}
                      <ChevronDown className="size-3 opacity-60" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto">
                      {MODEL_ROUTING_GROUPS.map((group) => (
                        <div key={group.id}>
                          {group.label ? (
                            <>
                              <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                              {group.options.map((opt) => (
                                <DropdownMenuItem
                                  key={opt.id}
                                  disabled={modelRoutingLocked(opt.id, llm)}
                                  onClick={() => saveModel(opt.id)}
                                >
                                  {opt.label}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                            </>
                          ) : (
                            group.options.map((opt) => (
                              <DropdownMenuItem key={opt.id} onClick={() => saveModel(opt.id)}>
                                {opt.label}
                              </DropdownMenuItem>
                            ))
                          )}
                        </div>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    type="submit"
                    disabled={busy || !input.trim()}
                    className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-35"
                    aria-label="Send"
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowUp className="size-4 stroke-[2.5]" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            <p className="mt-2 px-1 text-center text-xs text-muted-foreground">
              {authRequired
                ? "Guest limit reached — sign in to continue."
                : `${remaining} free guest message${remaining === 1 ? "" : "s"} left · Default language English`}
            </p>
          </form>
        </div>
      </div>

      <DesktopBuildRequiredDialog open={buildOpen} onOpenChange={setBuildOpen} />

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Continue with CINEM Pro</DialogTitle>
            <DialogDescription>
              You&apos;ve used {GUEST_CHAT_MESSAGE_LIMIT} guest messages. Create a free account or
              log in to keep chatting, open the desk, and run agents.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button nativeButton={false} render={<Link href="/signup" />}>
              Sign up free
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/login" />}>
              Log in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={navOpen} onOpenChange={setNavOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Menu
              <button type="button" aria-label="Close" onClick={() => setNavOpen(false)}>
                <X className="size-4" />
              </button>
            </DialogTitle>
          </DialogHeader>
          <nav className="flex flex-col gap-2">
            {TOP_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2 py-2 text-sm hover:bg-muted"
                onClick={() => setNavOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </DialogContent>
      </Dialog>
    </div>
  );
}
