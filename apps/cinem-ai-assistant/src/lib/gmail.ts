/**
 * Gmail integration (OSCAR — Email Agent).
 *
 * Desktop OAuth 2.0 with PKCE + loopback redirect:
 *   1. Rust `oauth_listen` binds 127.0.0.1:17865 and waits for the redirect
 *   2. system browser opens Google's consent screen
 *   3. code → tokens (refresh token persisted in settings)
 *   4. Gmail REST: unread inbox, message details, SAFE sending via DRAFTS
 *      (Cinem AI Assistant never auto-sends — you review drafts in Gmail).
 *
 * Scopes: gmail.readonly + gmail.compose (drafts only, no send).
 */
import { useSettingsStore, type Settings } from "@/store/useSettingsStore";
import { openExternal } from "@/lib/quickActions";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const PORT = 17865;
const REDIRECT = `http://127.0.0.1:${PORT}`;
const SCOPES = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose";

async function doFetch(url: string, init?: RequestInit): Promise<Response> {
  const f = IS_TAURI ? (await import("@tauri-apps/plugin-http")).fetch : window.fetch.bind(window);
  return f(url, init);
}

export const gmailConnected = (s: Settings) => !!s.gmailRefreshToken;

/* ── PKCE helpers ─────────────────────────────────────────────────── */

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const verifier = b64url(raw);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(digest) };
}

/* ── Connect / disconnect ─────────────────────────────────────────── */

/** Full OAuth flow. Resolves to the connected Gmail address. */
export async function connectGmail(): Promise<string> {
  if (!IS_TAURI) throw new Error("Gmail connect requires the desktop build.");
  const s = useSettingsStore.getState();
  if (!s.gmailClientId || !s.gmailClientSecret) {
    throw new Error("Google OAuth client not configured (Settings → API).");
  }

  const { verifier, challenge } = await pkcePair();
  const { invoke } = await import("@tauri-apps/api/core");

  // 1 — start the loopback listener FIRST (so the redirect can't be missed)
  const codePromise = invoke<string>("oauth_listen", { port: PORT });

  // 2 — consent screen in the system browser
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", s.gmailClientId);
  auth.searchParams.set("redirect_uri", REDIRECT);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", SCOPES);
  auth.searchParams.set("code_challenge", challenge);
  auth.searchParams.set("code_challenge_method", "S256");
  auth.searchParams.set("access_type", "offline");
  auth.searchParams.set("prompt", "consent"); // guarantees a refresh_token
  await openExternal(auth.toString());

  // 3 — wait for the redirect, then exchange code → tokens
  const code = await codePromise;
  const tokenRes = await doFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: s.gmailClientId,
      client_secret: s.gmailClientSecret,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }).toString(),
  });
  if (!tokenRes.ok) throw new Error(`Token exchange failed: ${await tokenRes.text()}`);
  const tokens = (await tokenRes.json()) as { access_token: string; refresh_token?: string };
  if (!tokens.refresh_token) throw new Error("Google did not return a refresh token — try again.");

  cachedAccess = { token: tokens.access_token, exp: Date.now() + 50 * 60_000 };

  // 4 — who connected?
  const prof = await gmailApi<{ emailAddress: string }>("profile", tokens.access_token);
  await useSettingsStore.getState().update({
    gmailRefreshToken: tokens.refresh_token,
    gmailEmail: prof.emailAddress,
  });
  return prof.emailAddress;
}

export async function disconnectGmail(): Promise<void> {
  const s = useSettingsStore.getState();
  if (s.gmailRefreshToken) {
    // best-effort revoke
    void doFetch(`https://oauth2.googleapis.com/revoke?token=${s.gmailRefreshToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }).catch(() => undefined);
  }
  cachedAccess = null;
  await s.update({ gmailRefreshToken: "", gmailEmail: "" });
}

/* ── Access token (refresh grant, cached) ─────────────────────────── */

let cachedAccess: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedAccess && Date.now() < cachedAccess.exp) return cachedAccess.token;
  const s = useSettingsStore.getState();
  if (!s.gmailRefreshToken) throw new Error("Gmail is not connected (Settings → API → Connect Gmail).");
  const res = await doFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: s.gmailClientId,
      client_secret: s.gmailClientSecret,
      refresh_token: s.gmailRefreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) throw new Error(`Gmail token refresh failed: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccess = { token: data.access_token, exp: Date.now() + (data.expires_in - 120) * 1000 };
  return data.access_token;
}

async function gmailApi<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const t = token ?? (await accessToken());
  const res = await doFetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/* ── Inbox ────────────────────────────────────────────────────────── */

export interface MailItem {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
}

/** Latest unread primary-inbox messages with headers + snippet. */
export async function listUnread(max = 8): Promise<MailItem[]> {
  const list = await gmailApi<{ messages?: { id: string }[] }>(
    `messages?q=${encodeURIComponent("is:unread category:primary")}&maxResults=${max}`,
  );
  const ids = list.messages ?? [];
  const items = await Promise.all(
    ids.map(async ({ id }) => {
      const m = await gmailApi<{
        snippet: string;
        payload?: { headers?: { name: string; value: string }[] };
      }>(`messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
      const h = (n: string) =>
        m.payload?.headers?.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
      return { id, from: h("From"), subject: h("Subject"), snippet: m.snippet ?? "", date: h("Date") };
    }),
  );
  return items;
}

/* ── SAFE sending: drafts only ────────────────────────────────────── */

/** Creates a Gmail DRAFT (never auto-sends — user reviews in Gmail). */
export async function createDraft(to: string, subject: string, body: string): Promise<void> {
  const rfc822 =
    `To: ${to}\r\n` +
    `Subject: ${subject}\r\n` +
    `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
    body;
  const raw = b64url(new TextEncoder().encode(rfc822));
  await gmailApi("drafts", undefined, {
    method: "POST",
    body: JSON.stringify({ message: { raw } }),
  });
}
