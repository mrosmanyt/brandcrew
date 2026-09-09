"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import {
  ANNOUNCEMENT_DISMISS_EVENT,
  ANNOUNCEMENT_DISMISS_KEY,
  FOUNDER_MAILTO,
} from "@/lib/site";

/** Dismiss preference only — never a session JWT or brandcrew_session. */

function readDismissed() {
  try {
    return window.localStorage.getItem(ANNOUNCEMENT_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(ANNOUNCEMENT_DISMISS_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(ANNOUNCEMENT_DISMISS_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function writeDismissed() {
  try {
    window.localStorage.setItem(ANNOUNCEMENT_DISMISS_KEY, "1");
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(ANNOUNCEMENT_DISMISS_EVENT));
}

function syncAnnounceHeight(dismissed: boolean) {
  const canvas = document.querySelector(".marketing-canvas");
  if (!(canvas instanceof HTMLElement)) return;
  const banner = dismissed
    ? null
    : document.querySelector("[data-announcement]");
  const height = banner instanceof HTMLElement ? banner.offsetHeight : 0;
  canvas.style.setProperty("--announce-h", `${height}px`);
}

export function AnnouncementBanner() {
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => false);

  useLayoutEffect(() => {
    syncAnnounceHeight(dismissed);
    const banner = document.querySelector("[data-announcement]");
    if (!(banner instanceof HTMLElement)) return;
    const observer = new ResizeObserver(() => syncAnnounceHeight(false));
    observer.observe(banner);
    return () => {
      observer.disconnect();
      syncAnnounceHeight(true);
    };
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <div
      data-announcement=""
      role="region"
      aria-label="Fundraising announcement"
      className="sticky top-0 z-40 bg-foreground text-background"
    >
      <div className="relative mx-auto flex min-h-10 w-full max-w-5xl items-center justify-center px-11 py-2 sm:px-12">
        <p className="text-center text-[13px] leading-5 sm:text-sm">
          We&apos;re raising a $5M round to build the AI employee desk.{" "}
          <a
            href={FOUNDER_MAILTO}
            className="whitespace-nowrap font-medium underline decoration-background/40 underline-offset-4 transition-colors hover:decoration-background"
          >
            Talk to the founder
          </a>
        </p>
        <button
          type="button"
          onClick={writeDismissed}
          aria-label="Dismiss announcement"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-background/75 transition-colors hover:bg-background/10 hover:text-background sm:right-3"
        >
          <X className="size-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
