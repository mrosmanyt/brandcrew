import * as SecureStore from "expo-secure-store";
import { deskOrigin } from "./config";

const ACCESS_KEY = "cinem_access_token";
const REFRESH_KEY = "cinem_refresh_token";

export type NativeSession = {
  accessToken: string;
  refreshToken: string;
  user?: { id: string; email: string; name: string } | null;
  workspaceId?: string | null;
};

export async function loadSession(): Promise<NativeSession | null> {
  const accessToken = await SecureStore.getItemAsync(ACCESS_KEY);
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function saveSession(session: NativeSession) {
  await SecureStore.setItemAsync(ACCESS_KEY, session.accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, session.refreshToken);
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

async function authFetch(path: string, init: RequestInit = {}) {
  const origin = deskOrigin();
  const res = await fetch(`${origin}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Cinem-Client": "mobile",
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function loginWithPassword(email: string, password: string): Promise<NativeSession> {
  const data = await authFetch("/api/auth/token", {
    method: "POST",
    body: JSON.stringify({ email, password, tokens: true, surface: "mobile", deviceName: "Android" }),
  });
  const session = {
    accessToken: data.accessToken as string,
    refreshToken: data.refreshToken as string,
    user: data.user,
  };
  await saveSession(session);
  return session;
}

export async function refreshSession(refreshToken: string): Promise<NativeSession> {
  const data = await authFetch("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken, surface: "mobile" }),
  });
  const session = {
    accessToken: data.accessToken as string,
    refreshToken: data.refreshToken as string,
    user: data.user,
  };
  await saveSession(session);
  return session;
}

/** Create an approved ticket the WebView can consume to set the web session cookie. */
export async function createSessionBridge(accessToken: string): Promise<string> {
  const data = await authFetch("/api/auth/connect", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ surface: "mobile", deviceName: "Android" }),
  });
  const origin = deskOrigin();
  return `${origin}/connect/session?nonce=${data.nonce}`;
}

export async function logout(refreshToken?: string | null) {
  try {
    await authFetch("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: refreshToken || undefined }),
    });
  } catch {
    // still clear local
  }
  await clearSession();
}
