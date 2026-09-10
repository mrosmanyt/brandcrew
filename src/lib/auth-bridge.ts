/**
 * Client-safe multi-surface auth constants and URL helpers.
 * Server token issue/verify lives in auth.ts + auth-native.ts.
 *
 * Web keeps the HttpOnly `brandcrew_session` cookie. Desktop, mobile, and
 * the Chrome extension use the same access JWT (Authorization: Bearer) plus
 * a hashed refresh token (`cinem_rt_…`). Extension jobs still use device
 * tokens (`cinem_dev_…`) after an account-linked attach.
 */

import { SITE_ORIGIN } from "@/lib/site";

export const AUTH_SURFACES = ["web", "desktop", "mobile", "extension"] as const;
export type AuthSurface = (typeof AUTH_SURFACES)[number];

export const CONNECT_SURFACES = ["desktop", "mobile", "extension"] as const;
export type ConnectSurface = (typeof CONNECT_SURFACES)[number];

export const REFRESH_TOKEN_PREFIX = "cinem_rt_";
export const ACCESS_TOKEN_TTL_SEC = 30 * 24 * 60 * 60;
export const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const CONNECT_TICKET_TTL_MS = 15 * 60 * 1000;

export const DESKTOP_PROTOCOL = "cinem-pro";
export const ANDROID_PACKAGE_ID = "tech.cinem.pro";
export const ANDROID_APP_NAME = "CINEM Pro";

/** Canonical production desk (`SITE_ORIGIN`). Packaged Electron and store clients. Override with CINEM_CLOUD_URL / APP_URL. Vercel alias remains allowed. */
export const CLOUD_DESK_ORIGIN = SITE_ORIGIN;

export const CHROME_WEB_STORE_URL = "";

export function isAuthSurface(value: string): value is AuthSurface {
  return (AUTH_SURFACES as readonly string[]).includes(value);
}

export function isConnectSurface(value: string): value is ConnectSurface {
  return (CONNECT_SURFACES as readonly string[]).includes(value);
}

export function connectPath(surface: ConnectSurface, nonce: string) {
  const params = new URLSearchParams({ nonce });
  return `/connect/${surface}?${params.toString()}`;
}

export function connectApproveUrl(origin: string, surface: ConnectSurface, nonce: string) {
  const base = origin.replace(/\/$/, "");
  return `${base}${connectPath(surface, nonce)}`;
}

export function desktopDeepLink(nonce: string, origin: string) {
  const params = new URLSearchParams({ nonce, origin: origin.replace(/\/$/, "") });
  return `${DESKTOP_PROTOCOL}://connect?${params.toString()}`;
}

export function mobileDeepLink(nonce: string, origin: string) {
  const params = new URLSearchParams({ nonce, origin: origin.replace(/\/$/, "") });
  return `${DESKTOP_PROTOCOL}://connect?${params.toString()}`;
}

export function parseConnectNonce(raw: string | null | undefined) {
  const value = String(raw || "").trim().toLowerCase();
  if (!/^[a-f0-9]{16,64}$/.test(value)) return null;
  return value;
}

/** Extract a nonce from a pasted login link or raw hex. */
export function nonceFromLoginLink(raw: string) {
  const trimmed = raw.trim();
  const asNonce = parseConnectNonce(trimmed);
  if (asNonce) return asNonce;
  try {
    const url = new URL(trimmed);
    return parseConnectNonce(url.searchParams.get("nonce"));
  } catch {
    const match = /[?&]nonce=([a-fA-F0-9]{16,64})/.exec(trimmed);
    return match ? parseConnectNonce(match[1]) : null;
  }
}
