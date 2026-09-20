/**
 * CINEM Pro cloud session + usage meter for the Windows assistant.
 * Tokens and checkout are the existing desk APIs — no new Whop SKU.
 */
import {
  assistantUpgradeUrl,
  CINEM_AI_ASSISTANT_USAGE_PATH,
  cloudOrigin,
  type CinemAiAssistantUsageResponse,
} from "../../usage-client";
import { cinemDesktopBridge, openExternal } from "@/lib/desktop-shell";

export const CINEM_CLIENT = "assistant";
export const DEVICE_NAME = "Cinem AI Assistant";

const ACCESS_KEY = "cinem_assistant_access";
const REFRESH_KEY = "cinem_assistant_refresh";
const USER_KEY = "cinem_assistant_user";

export type CinemSessionUser = {
  id: string;
  email: string;
  name: string;
};

export type CinemSession = {
  accessToken: string;
  refreshToken: string;
  user: CinemSessionUser | null;
};

export function cinemCloudOrigin() {
  return cloudOrigin(import.meta.env.VITE_CINEM_CLOUD_URL);
}

export function fallbackUpgradeUrl() {
  return (
    import.meta.env.VITE_CINEM_UPGRADE_URL?.replace(/\/$/, "") ||
    assistantUpgradeUrl(cinemCloudOrigin())
  );
}

export function readSession(): CinemSession | null {
  const accessToken = localStorage.getItem(ACCESS_KEY) || "";
  const refreshToken = localStorage.getItem(REFRESH_KEY) || "";
  if (!accessToken && !refreshToken) return null;
  let user: CinemSessionUser | null = null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) user = JSON.parse(raw) as CinemSessionUser;
  } catch {
    user = null;
  }
  return { accessToken, refreshToken, user };
}

export function writeSession(session: CinemSession) {
  localStorage.setItem(ACCESS_KEY, session.accessToken);
  localStorage.setItem(REFRESH_KEY, session.refreshToken);
  if (session.user) localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  else localStorage.removeItem(USER_KEY);
  const bridge = cinemDesktopBridge();
  if (bridge?.storeSession && session.refreshToken) {
    void bridge.storeSession({
      refreshToken: session.refreshToken,
      accessToken: session.accessToken,
    });
  }
}

/**
 * Unified Electron shell: desk `userData` refresh is the same CINEM Pro
 * account. Prefer it when local assistant tokens are missing or stale so
 * a paid web/desk login is not stuck on a leftover Free session.
 */
export async function syncDesktopSession(): Promise<CinemSession | null> {
  const local = readSession();
  const bridge = cinemDesktopBridge();
  const stored = bridge?.getStoredSession ? await bridge.getStoredSession() : null;
  const shared = stored?.refreshToken?.trim() || "";
  if (shared && shared !== local?.refreshToken) {
    try {
      return await refreshSession(shared);
    } catch {
      /* keep local if the shared token is expired */
    }
  }
  if (local?.accessToken || local?.refreshToken) return local;
  if (shared) {
    try {
      return await refreshSession(shared);
    } catch {
      return null;
    }
  }
  return null;
}

/** Prefer local tokens; otherwise adopt the Electron cloud-shell refresh token. */
export async function adoptDesktopSession(): Promise<CinemSession | null> {
  return syncDesktopSession();
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

function authHeaders(accessToken?: string, json = false): HeadersInit {
  return {
    "X-Cinem-Client": CINEM_CLIENT,
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

async function cloudFetch(path: string, init: RequestInit = {}) {
  return fetch(`${cinemCloudOrigin()}${path}`, { cache: "no-store", ...init });
}

export async function refreshSession(refreshToken: string): Promise<CinemSession> {
  const res = await cloudFetch("/api/auth/refresh", {
    method: "POST",
    headers: authHeaders(undefined, true),
    body: JSON.stringify({ refreshToken, surface: "desktop" }),
  });
  const data = (await res.json()) as CinemSession & { error?: string };
  if (!res.ok || !data.accessToken) {
    throw new Error(data.error || "Session expired. Sign in again.");
  }
  const next: CinemSession = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken || refreshToken,
    user: data.user ?? readSession()?.user ?? null,
  };
  writeSession(next);
  return next;
}

export async function withFreshAccess<T>(fn: (accessToken: string) => Promise<T>): Promise<T> {
  const session = readSession();
  if (!session?.accessToken && !session?.refreshToken) {
    throw new Error("Sign in to continue.");
  }
  try {
    return await fn(session.accessToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const unauthorized = /unauthorized|sign in|expired/i.test(message);
    if (!session.refreshToken || !unauthorized) throw error;
    const refreshed = await refreshSession(session.refreshToken);
    return fn(refreshed.accessToken);
  }
}

export async function fetchUsage(turns?: number): Promise<CinemAiAssistantUsageResponse> {
  return withFreshAccess(async (accessToken) => {
    const increment = typeof turns === "number";
    const res = await cloudFetch(CINEM_AI_ASSISTANT_USAGE_PATH, {
      method: increment ? "POST" : "GET",
      headers: authHeaders(accessToken, increment),
      body: increment ? JSON.stringify({ turns }) : undefined,
    });
    const data = (await res.json()) as CinemAiAssistantUsageResponse & { error?: string };
    if (res.status === 401) {
      throw new Error(data.error || "Unauthorized");
    }
    if (data.code === "PRO_REQUIRED" || (res.status === 402 && data.error === "Pro required")) {
      return {
        ...data,
        allowed: false,
        proRequired: true,
        code: "PRO_REQUIRED",
        upgradeUrl: data.upgradeUrl || fallbackUpgradeUrl(),
        whatsappUrl: data.whatsappUrl,
      };
    }
    if (!res.ok && !data.upgradeUrl) {
      throw new Error(data.error || `Usage request failed (${res.status})`);
    }
    return {
      ...data,
      upgradeUrl: data.upgradeUrl || fallbackUpgradeUrl(),
    };
  });
}

/** Reserve one chat/voice turn. GET first so the last remaining turn still runs. */
export async function consumeAssistantTurn(): Promise<CinemAiAssistantUsageResponse> {
  const before = await fetchUsage();
  if (before.proRequired || before.code === "PRO_REQUIRED" || !before.allowed) {
    return { ...before, allowed: false };
  }
  const after = await fetchUsage(1);
  if (after.proRequired || after.code === "PRO_REQUIRED") {
    return { ...after, allowed: false };
  }
  return { ...after, allowed: true };
}

export async function signInWithPassword(email: string, password: string): Promise<CinemSession> {
  const res = await cloudFetch("/api/auth/token", {
    method: "POST",
    headers: authHeaders(undefined, true),
    body: JSON.stringify({
      email,
      password,
      tokens: true,
      surface: "desktop",
      deviceName: DEVICE_NAME,
    }),
  });
  const data = (await res.json()) as CinemSession & { error?: string };
  if (!res.ok || !data.accessToken) {
    throw new Error(data.error || "Could not sign in.");
  }
  const session: CinemSession = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  };
  writeSession(session);
  return session;
}

export type ConnectStart = {
  nonce: string;
  approveUrl: string;
  expiresAt?: string;
};

export async function startBrowserSignIn(): Promise<ConnectStart> {
  const origin = cinemCloudOrigin();
  const res = await cloudFetch("/api/auth/connect", {
    method: "POST",
    headers: authHeaders(undefined, true),
    body: JSON.stringify({
      surface: "desktop",
      deviceName: DEVICE_NAME,
      origin,
    }),
  });
  const data = (await res.json()) as ConnectStart & { error?: string };
  if (!res.ok || !data.nonce || !data.approveUrl) {
    throw new Error(data.error || "Could not start CINEM Pro sign-in.");
  }
  await openExternal(data.approveUrl);
  return data;
}

export async function claimBrowserSignIn(nonce: string): Promise<CinemSession | "pending"> {
  const res = await cloudFetch("/api/auth/connect/claim", {
    method: "POST",
    headers: authHeaders(undefined, true),
    body: JSON.stringify({ nonce }),
  });
  const data = (await res.json()) as {
    status?: string;
    accessToken?: string;
    refreshToken?: string;
    token?: string;
    user?: CinemSessionUser;
    error?: string;
  };
  if (res.status === 410) throw new Error(data.error || "That sign-in link expired.");
  if (res.status === 409) throw new Error(data.error || "Already used. Start again.");
  if (!res.ok) throw new Error(data.error || "Sign-in failed.");
  if (data.status === "pending" || data.status === "unknown") return "pending";
  if (data.accessToken && data.refreshToken) {
    const session: CinemSession = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user ?? null,
    };
    writeSession(session);
    return session;
  }
  if (data.token) {
    const session: CinemSession = {
      accessToken: data.token,
      refreshToken: "",
      user: data.user ?? null,
    };
    writeSession(session);
    return session;
  }
  return "pending";
}

export function formatAssistantSignInError(error: unknown) {
  const raw = error instanceof Error ? error.message : "Could not sign in.";
  if (/uses Google/i.test(raw)) {
    return "This account uses Google. Use Sign in with CINEM Pro in the browser instead of email and password.";
  }
  return raw;
}

export async function openUpgrade(upgradeUrl?: string) {
  await openExternal(upgradeUrl || fallbackUpgradeUrl());
}

export async function signOutCloud() {
  const session = readSession();
  if (session?.refreshToken) {
    await cloudFetch("/api/auth/revoke", {
      method: "POST",
      headers: authHeaders(undefined, true),
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    }).catch(() => undefined);
  }
  clearSession();
}
