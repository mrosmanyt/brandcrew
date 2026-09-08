"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  COOKIE_CONSENT_EVENT,
  COOKIE_CONSENT_KEY,
} from "@/lib/site";

export type CookieConsent = "accepted" | "essential";

function readConsent(): CookieConsent | "unset" {
  try {
    const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (value === "accepted" || value === "essential") return value;
  } catch {
    /* private mode */
  }
  return "unset";
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(COOKIE_CONSENT_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(COOKIE_CONSENT_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function writeConsent(value: CookieConsent) {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
}

export function CookieBanner() {
  const consent = useSyncExternalStore(subscribe, readConsent, () => "accepted");
  if (consent !== "unset") return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
      <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-foreground">
          CINEM Pro uses an essential session cookie to keep you signed in.
          Optional analytics load only if you accept and an analytics id is
          configured.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => writeConsent("essential")}
          >
            Essential only
          </Button>
          <Button type="button" size="sm" onClick={() => writeConsent("accepted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
