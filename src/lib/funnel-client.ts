"use client";

const ANON_ID_KEY = "cinem_funnel_anon_id";

/** Random id kept in localStorage only — never a cookie, never tied to auth. */
export function funnelAnonId(): string {
  try {
    const existing = window.localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(ANON_ID_KEY, fresh);
    return fresh;
  } catch {
    return "anon_unknown";
  }
}

/** Fire-and-forget funnel beacon. Never blocks navigation, never throws. */
export function trackFunnelEvent(kind: "site_visit" | "whatsapp_click", path?: string) {
  try {
    const body = JSON.stringify({ kind, anonId: funnelAnonId(), path: path || window.location.pathname });
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/funnel", blob)) return;
    void fetch("/api/funnel", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
  } catch {
    /* best-effort only */
  }
}
