"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cinemAiAssistantDownloadHref } from "@/lib/cinem-ai-assistant";
import { WIN_SETUP_FILENAME } from "@/lib/site";
import { cn } from "@/lib/utils";
import {
  WIN_DOWNLOAD_NUDGE_LOCAL_KEY,
  WIN_DOWNLOAD_NUDGE_SESSION_KEY,
  shouldOfferWindowsDownloadNudge,
} from "@/lib/windows-download-nudge";

function readFlag(storage: Storage, key: string) {
  try {
    return storage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(storage: Storage, key: string) {
  try {
    storage.setItem(key, "1");
  } catch {
    /* private mode */
  }
}

function WindowsMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <rect x="1" y="1" width="6.4" height="6.4" rx="0.6" />
      <rect x="8.6" y="1" width="6.4" height="6.4" rx="0.6" />
      <rect x="1" y="8.6" width="6.4" height="6.4" rx="0.6" />
      <rect x="8.6" y="8.6" width="6.4" height="6.4" rx="0.6" />
    </svg>
  );
}

/**
 * Compact top-right Windows download card.
 * Decides once on desk/home entry — no chat, job, or stream subscriptions.
 */
export function WindowsDownloadNudge({
  placement = "desk",
}: {
  placement?: "desk" | "marketing";
}) {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Path / UA / storage only — never job streams, chat tokens, or status polls.
    const offer = shouldOfferWindowsDownloadNudge({
      userAgent: navigator.userAgent || "",
      platform: navigator.platform || "",
      pathname,
      sessionDismissed: readFlag(sessionStorage, WIN_DOWNLOAD_NUDGE_SESSION_KEY),
      localHidden: readFlag(localStorage, WIN_DOWNLOAD_NUDGE_LOCAL_KEY),
    });
    setOpen(offer);
  }, [pathname]);

  function dismiss() {
    writeFlag(sessionStorage, WIN_DOWNLOAD_NUDGE_SESSION_KEY);
    setOpen(false);
  }

  function dismissForever() {
    writeFlag(localStorage, WIN_DOWNLOAD_NUDGE_LOCAL_KEY);
    writeFlag(sessionStorage, WIN_DOWNLOAD_NUDGE_SESSION_KEY);
    setOpen(false);
  }

  if (!open) return null;

  const href = cinemAiAssistantDownloadHref();

  return (
    <aside
      role="region"
      aria-label="Get CINEM Pro for Windows"
      className={cn(
        "pointer-events-none fixed right-4 z-40 hidden w-[min(21.5rem,calc(100vw-2rem))] md:block",
        placement === "marketing" ? "top-20" : "top-14",
      )}
    >
      <div className="pointer-events-auto rounded-xl border border-border bg-card/95 p-3.5 shadow-lg shadow-black/25 ring-1 ring-foreground/5 backdrop-blur-md">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
            <WindowsMark className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium tracking-tight text-foreground">
              Get CINEM Pro for Windows
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              Desk + AI Assistant in one Setup.exe
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Dismiss Windows download"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            nativeButton={false}
            render={
              <a
                href={href}
                download={WIN_SETUP_FILENAME}
                onClick={dismiss}
              />
            }
          >
            <Download data-icon="inline-start" />
            Download
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
            Not now
          </Button>
        </div>
        <button
          type="button"
          onClick={dismissForever}
          className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Don&apos;t show again
        </button>
      </div>
    </aside>
  );
}
