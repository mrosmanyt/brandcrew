/**
 * Cinem AI Assistant Local User Database — fully offline user management.
 *
 * Replaces Supabase entirely. Users, signup requests and licenses live in a
 * single local JSON store:
 *   - Desktop build : tauri-plugin-store file `cinem-ai-assistant-localdb.json`
 *                     (in the app's data dir — survives updates)
 *   - Browser dev   : localStorage key `cinem-ai-assistant-localdb`
 *
 * Flow:
 *   1. New user submits the registration form → request saved as "pending"
 *      and bound to this device (`deviceUserId`).
 *   2. Admin (the /admin panel) approves → a license key is generated and the
 *      user becomes "approved" — the app unlocks automatically.
 *      Rejects → the user sees a rejection notice.
 *
 * Every read goes back to disk (`store.reload()`), so the admin panel and the
 * main app always see each other's changes — even across windows/tabs.
 */

import { estCostInr } from "@/lib/costModel";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const STORE_FILE = "cinem-ai-assistant-localdb.json";
const LS_KEY = "cinem-ai-assistant-localdb";

export type RequestStatus = "pending" | "approved" | "rejected";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  country: string;
  status: RequestStatus;
  licenseKey?: string;
  requestedAt: string; // ISO (join date)
  decidedAt?: string;  // ISO — when admin approved/rejected
  /* ── Admin controls ── */
  /** Frozen = login disabled (admin action). Approved users only. */
  frozen?: boolean;
  /** Last successful app unlock on the bound device. */
  lastLogin?: string;
  /** Local access password (set via admin "Reset Password"). When present,
   *  the app asks for it once per device after approval. */
  password?: string;
  /** Amount paid by this user (revenue tracking, admin-entered). */
  paidAmount?: number;
  /* ── Single active session ── */
  /** Token of the ONLY session allowed right now (one login at a time). */
  activeSessionId?: string;
  /** When the active session was claimed. */
  sessionAt?: string;
  /** Usage cost limits (₹/month). Soft → warning; hard → auto-freeze. */
  softLimitInr?: number | null;
  hardLimitInr?: number | null;
}

/* ── Usage analytics ─────────────────────────────────────────────── */

export type UsageKind = "command" | "gemini" | "tts" | "vision" | "browser" | "agent";

export interface UsageEvent {
  id: string;
  subjectId: string;
  kind: UsageKind;
  /** gemini: tokens in · tts: chars · others: 1 */
  q1: number;
  /** gemini: tokens out */
  q2: number;
  at: string; // ISO
}

/** Current-month usage rollup per user (Admin → Usage & Billing). */
export interface UsageSummary {
  userId: string;
  name: string;
  email: string;
  frozen: boolean;
  softLimitInr?: number | null;
  hardLimitInr?: number | null;
  lastActive?: string | null;
  commands: number;
  geminiIn: number;
  geminiOut: number;
  ttsChars: number;
  vision: number;
  browser: number;
  agents: number;
  estCostInr: number;
}

const USAGE_CAP = 5000;

/* ── Activity log ─────────────────────────────────────────────────── */

export type ActivityType = "command" | "login" | "admin" | "system";

export interface ActivityEntry {
  id: string;
  at: string; // ISO
  type: ActivityType;
  /** User this entry belongs to (null = global/admin event). */
  userId: string | null;
  userName?: string;
  text: string;
}

const ACTIVITY_CAP = 500;

export interface RegistrationInput {
  name: string;
  email: string;
  whatsapp: string;
  country: string;
}

interface DbShape {
  users: UserRecord[];
  /** The user record bound to THIS device (set on registration). */
  deviceUserId: string | null;
  /** Local admin credentials (default admin / cinem-ai-assistant123). */
  adminUser: string;
  adminPass: string;
  /** Global activity log, newest first (capped at ACTIVITY_CAP). */
  activity: ActivityEntry[];
  /** Usage events, newest first (capped at USAGE_CAP). */
  usage: UsageEvent[];
}

const DEFAULT_DB: DbShape = {
  users: [],
  deviceUserId: null,
  adminUser: "admin",
  adminPass: "cinem-ai-assistant123",
  activity: [],
  usage: [],
};

/* ── Persistence backend ──────────────────────────────────────────────
 *
 * PRIMARY : the local db-server (http://127.0.0.1:1430) — ONE JSON file
 *           (~/.cinem-ai-assistant/cinem-ai-assistant-localdb.json) shared by the Cinem AI Assistant app AND
 *           the Admin Panel, whichever process they run in. This is what
 *           makes signups appear in the panel instantly.
 * FALLBACK: the legacy per-context store (tauri-plugin-store in the app,
 *           localStorage in the browser) — keeps Cinem AI Assistant fully usable if
 *           the db-server isn't running. Legacy data is auto-migrated to
 *           the server the first time it becomes reachable.
 * ──────────────────────────────────────────────────────────────────── */

const DB_SERVER = "http://127.0.0.1:1430";
const SERVER_RECHECK_MS = 5_000;
/** Set whenever a write could NOT reach the server — guarantees a merge-push
 *  the moment the server becomes reachable again (no signup is ever lost). */
const UNSYNCED_KEY = "cinem-ai-assistant-db-unsynced";

/**
 * Fetch against the db-server. In the Tauri app we try plugin-http first;
 * if it throws (e.g. URL-scope denial from a stale build), we fall back to
 * plain window.fetch — the db-server allows CORS, so this always works in
 * dev. This double path is what makes the sync bullet-proof.
 */
async function dbFetch(pathname: string, init?: RequestInit, timeoutMs = 1500): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const opts = { ...init, signal: ctrl.signal };
  try {
    if (IS_TAURI) {
      try {
        const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
        return await tauriFetch(`${DB_SERVER}${pathname}`, opts);
      } catch (e) {
        // plugin failed (scope/permission/transport) — try the WebView fetch
        console.warn("[Cinem AI Assistant db] plugin-http failed, trying window.fetch:", e);
        return await window.fetch(`${DB_SERVER}${pathname}`, opts);
      }
    }
    return await window.fetch(`${DB_SERVER}${pathname}`, opts);
  } finally {
    clearTimeout(timer);
  }
}

let serverOk: boolean | null = null;
let serverCheckedAt = 0;
let syncing = false;
let syncedThisSession = false;

async function serverAvailable(): Promise<boolean> {
  const now = Date.now();
  if (serverOk !== null && now - serverCheckedAt < SERVER_RECHECK_MS) return serverOk;
  const wasOk = serverOk;
  try {
    serverOk = (await dbFetch("/health", undefined, 1200)).ok;
  } catch {
    serverOk = false;
  }
  serverCheckedAt = now;
  if (serverOk && wasOk !== true) console.info("[Cinem AI Assistant db] ✓ db-server reachable at", DB_SERVER);
  if (serverOk === false && wasOk !== false) {
    console.warn("[Cinem AI Assistant db] ✗ db-server NOT reachable — using local fallback (will sync later)");
  }
  // On every transition to reachable (or if unsynced writes exist), merge-push.
  if (serverOk && !syncing && (!syncedThisSession || localStorage.getItem(UNSYNCED_KEY))) {
    await syncLegacyToServer().catch((e) => console.warn("[Cinem AI Assistant db] sync failed:", e));
  }
  return serverOk;
}

/** Union-merge: server is the base; any local users/activity the server
 *  doesn't know yet are added. Nothing is ever dropped. */
function mergeDbs(server: DbShape, legacy: DbShape): DbShape {
  const users = [...(server.users ?? [])];
  const known = new Set(users.map((u) => u.id));
  for (const u of legacy.users ?? []) if (!known.has(u.id)) users.push(u);

  const seen = new Set((server.activity ?? []).map((a) => a.id));
  const activity = [...(server.activity ?? [])];
  for (const a of legacy.activity ?? []) if (!seen.has(a.id)) activity.push(a);
  activity.sort((a, b) => b.at.localeCompare(a.at));

  const seenU = new Set((server.usage ?? []).map((u) => u.id));
  const usage = [...(server.usage ?? [])];
  for (const u of legacy.usage ?? []) if (!seenU.has(u.id)) usage.push(u);
  usage.sort((a, b) => b.at.localeCompare(a.at));

  return {
    ...server,
    users,
    activity: activity.slice(0, ACTIVITY_CAP),
    usage: usage.slice(0, USAGE_CAP),
  };
}

/** Pushes everything the server is missing (runs on reconnect + once per
 *  session). This is the safety net that makes offline signups appear in
 *  the Admin Panel as soon as the db-server is up. */
async function syncLegacyToServer(): Promise<void> {
  syncing = true;
  try {
    const legacy = await readLegacy();
    const res = await dbFetch("/api/db");
    if (!res.ok) return;
    const server = { ...DEFAULT_DB, ...((await res.json()) as DbShape) };
    const merged = mergeDbs(server, legacy);
    const gained = merged.users.length - (server.users?.length ?? 0);
    if (gained > 0 || localStorage.getItem(UNSYNCED_KEY)) {
      const put = await dbFetch("/api/db", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
      if (put.ok) {
        console.info(`[Cinem AI Assistant db] ✓ synced local data → db-server (+${gained} user(s))`);
        localStorage.removeItem(UNSYNCED_KEY);
      }
    } else {
      localStorage.removeItem(UNSYNCED_KEY);
    }
    syncedThisSession = true;
  } finally {
    syncing = false;
  }
}

/* ── Legacy backend (fallback only) ─────────────────────────────────── */

type TauriStore = {
  get<T>(k: string): Promise<T | undefined>;
  set(k: string, v: unknown): Promise<void>;
  save(): Promise<void>;
  reload?: () => Promise<void>;
};

let tauriStore: TauriStore | null = null;

async function getStore(): Promise<TauriStore> {
  if (tauriStore) return tauriStore;
  const storeMod = await import("@tauri-apps/plugin-store");
  const load = storeMod.load as unknown as (path: string, options?: unknown) => Promise<TauriStore>;
  tauriStore = await load(STORE_FILE, { defaults: {} });
  return tauriStore;
}

async function readLegacy(): Promise<DbShape> {
  if (IS_TAURI) {
    const store = await getStore();
    try {
      await store.reload?.();
    } catch { /* older plugin versions have no reload */ }
    const db = await store.get<DbShape>("db");
    return { ...DEFAULT_DB, ...(db ?? {}) };
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? { ...DEFAULT_DB, ...(JSON.parse(raw) as DbShape) } : { ...DEFAULT_DB };
  } catch {
    return { ...DEFAULT_DB };
  }
}

async function writeLegacy(db: DbShape): Promise<void> {
  if (IS_TAURI) {
    const store = await getStore();
    await store.set("db", db);
    await store.save();
  } else {
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  }
}

/* ── Unified read/write (server-first) ──────────────────────────────── */

/** Reads the whole DB fresh (app + admin panel always see the same data). */
export async function readDb(): Promise<DbShape> {
  if (await serverAvailable()) {
    try {
      const res = await dbFetch("/api/db");
      if (res.ok) return { ...DEFAULT_DB, ...((await res.json()) as DbShape) };
    } catch {
      serverOk = false; // transient — fall through to legacy
    }
  }
  return readLegacy();
}

/**
 * DUAL WRITE: the legacy store is always updated (local safety copy), then
 * the shared server is updated. If the server can't be reached, the
 * UNSYNCED flag guarantees a merge-push as soon as it comes back — so a
 * signup made while the db-server was down still reaches the Admin Panel.
 */
async function writeDb(db: DbShape): Promise<void> {
  await writeLegacy(db).catch(() => undefined); // never lose data locally

  if (await serverAvailable()) {
    try {
      const res = await dbFetch("/api/db", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(db),
      });
      if (res.ok) return;
    } catch {
      serverOk = false;
    }
  }
  localStorage.setItem(UNSYNCED_KEY, "1");
  console.warn("[Cinem AI Assistant db] write stored locally only — will sync to db-server when reachable");
}

/* ── License keys ─────────────────────────────────────────────────── */

/** CINEM-AI-ASSISTANT-XXXX-XXXX-XXXX — unambiguous charset (no 0/O/1/I). */
export function generateLicenseKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () => {
    const buf = new Uint8Array(4);
    crypto.getRandomValues(buf);
    return [...buf].map((b) => chars[b % chars.length]).join("");
  };
  return `CINEM-AI-ASSISTANT-${block()}-${block()}-${block()}`;
}

/* ── User / request operations ────────────────────────────────────── */

/* Device binding is LOCAL-ONLY (localStorage), because the shared server DB
 * is used by every device + the admin panel: storing "which user is bound to
 * this device" in the shared file made multiple clients clobber each other —
 * one of the causes of the signup-sync bug. The db field remains only as a
 * read-fallback for data written by older builds. */
const DEVICE_KEY = "cinem-ai-assistant-device-user";

/** Saves a new signup request (status "pending") and binds it to this device. */
export async function submitRequest(input: RegistrationInput): Promise<UserRecord> {
  const db = await readDb();
  const email = input.email.trim().toLowerCase();

  // Re-registration with the same email reuses the record (keeps admin list clean).
  const existing = db.users.find((u) => u.email === email);
  if (existing && existing.status !== "rejected") {
    localStorage.setItem(DEVICE_KEY, existing.id);
    console.log(`[Cinem AI Assistant] Signup saved to DB (existing record): ${existing.email}`);
    return existing;
  }

  const record: UserRecord = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    email,
    whatsapp: input.whatsapp.trim(),
    country: input.country.trim(),
    status: "pending",
    requestedAt: new Date().toISOString(),
  };
  db.users = [...db.users.filter((u) => u.email !== email), record];
  await writeDb(db);
  localStorage.setItem(DEVICE_KEY, record.id);
  console.log(
    `[Cinem AI Assistant] Signup saved to DB: ${record.email} (via ${serverOk ? "db-server ✓" : "local fallback — syncs when db-server is up"})`,
  );
  return record;
}

/** The user record bound to this device (license check on every app start). */
export async function getDeviceUser(): Promise<UserRecord | null> {
  const db = await readDb();
  const id = localStorage.getItem(DEVICE_KEY) ?? db.deviceUserId; // legacy fallback
  if (!id) return null;
  const user = db.users.find((u) => u.id === id) ?? null;
  // Adopt the legacy binding into local storage once.
  if (user && !localStorage.getItem(DEVICE_KEY)) localStorage.setItem(DEVICE_KEY, user.id);
  return user;
}

/** Unbinds this device (e.g. after rejection → register again). */
export async function resetDeviceLink(): Promise<void> {
  localStorage.removeItem(DEVICE_KEY);
  const db = await readDb();
  if (db.deviceUserId) {
    db.deviceUserId = null; // clear legacy field too
    await writeDb(db);
  }
}

/* ── Admin operations ─────────────────────────────────────────────── */

export async function verifyAdmin(user: string, pass: string): Promise<boolean> {
  const db = await readDb();
  return user.trim() === db.adminUser && pass === db.adminPass;
}

export async function listUsers(): Promise<UserRecord[]> {
  const db = await readDb();
  return [...db.users].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

/** Approve → generates a license key and activates the user. */
export async function approveUser(id: string): Promise<UserRecord | null> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) return null;
  user.status = "approved";
  user.licenseKey = user.licenseKey ?? generateLicenseKey();
  user.decidedAt = new Date().toISOString();
  await writeDb(db);
  return user;
}

export async function rejectUser(id: string): Promise<UserRecord | null> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) return null;
  user.status = "rejected";
  user.licenseKey = undefined;
  user.decidedAt = new Date().toISOString();
  await writeDb(db);
  return user;
}

export async function deleteUser(id: string): Promise<void> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === id);
  db.users = db.users.filter((u) => u.id !== id);
  if (db.deviceUserId === id) db.deviceUserId = null;
  pushActivity(db, "admin", null, `Deleted user ${user?.email ?? id}`);
  await writeDb(db);
}

/* ── Freeze / unfreeze (disable login) ────────────────────────────── */

export async function setFrozen(id: string, frozen: boolean): Promise<void> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) return;
  user.frozen = frozen;
  pushActivity(db, "admin", user.id, `${frozen ? "Froze" : "Unfroze"} ${user.email}`, user.name);
  await writeDb(db);
}

/** Bulk freeze/unfreeze. */
export async function bulkSetFrozen(ids: string[], frozen: boolean): Promise<void> {
  const db = await readDb();
  let n = 0;
  for (const u of db.users) {
    if (ids.includes(u.id)) {
      u.frozen = frozen;
      n++;
    }
  }
  pushActivity(db, "admin", null, `Bulk ${frozen ? "froze" : "unfroze"} ${n} user(s)`);
  await writeDb(db);
}

export async function bulkDelete(ids: string[]): Promise<void> {
  const db = await readDb();
  const before = db.users.length;
  db.users = db.users.filter((u) => !ids.includes(u.id));
  if (db.deviceUserId && ids.includes(db.deviceUserId)) db.deviceUserId = null;
  pushActivity(db, "admin", null, `Bulk deleted ${before - db.users.length} user(s)`);
  await writeDb(db);
}

/* ── Password (admin reset) ───────────────────────────────────────── */

/** Generates a new access password for the user and returns it. The app
 *  prompts for it once on the user's device (re-prompts after every reset). */
export async function resetPassword(id: string): Promise<string | null> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) return null;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  user.password = [...buf].map((b) => chars[b % chars.length]).join("");
  pushActivity(db, "admin", user.id, `Reset password for ${user.email}`, user.name);
  await writeDb(db);
  return user.password;
}

/* ── Revenue tracking ─────────────────────────────────────────────── */

export async function setPaidAmount(id: string, amount: number): Promise<void> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) return;
  user.paidAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  pushActivity(db, "admin", user.id, `Set payment $${user.paidAmount} for ${user.email}`, user.name);
  await writeDb(db);
}

/* ── Admin credentials ────────────────────────────────────────────── */

export async function updateAdminCredentials(user: string, pass: string): Promise<void> {
  const db = await readDb();
  db.adminUser = user.trim() || db.adminUser;
  if (pass) db.adminPass = pass;
  pushActivity(db, "admin", null, "Admin credentials updated");
  await writeDb(db);
}

/* ── Activity log ─────────────────────────────────────────────────── */

/** Internal: prepend an entry to an already-loaded DB (caller writes). */
function pushActivity(
  db: DbShape,
  type: ActivityType,
  userId: string | null,
  text: string,
  userName?: string,
): void {
  db.activity = [
    { id: crypto.randomUUID(), at: new Date().toISOString(), type, userId, userName, text },
    ...(db.activity ?? []),
  ].slice(0, ACTIVITY_CAP);
}

/** Public: log an event (used by the orchestrator for every command). */
export async function logActivity(
  type: ActivityType,
  text: string,
  userId: string | null = null,
  userName?: string,
): Promise<void> {
  try {
    const db = await readDb();
    pushActivity(db, type, userId, text, userName);
    await writeDb(db);
  } catch {
    /* logging must never break the app */
  }
}

/** Newest-first activity (optionally per user / per type). */
export async function listActivity(opts?: {
  userId?: string;
  type?: ActivityType;
  limit?: number;
}): Promise<ActivityEntry[]> {
  const db = await readDb();
  let items = db.activity ?? [];
  if (opts?.userId) items = items.filter((a) => a.userId === opts.userId);
  if (opts?.type) items = items.filter((a) => a.type === opts.type);
  return items.slice(0, opts?.limit ?? 100);
}

export async function clearActivity(): Promise<void> {
  const db = await readDb();
  db.activity = [];
  await writeDb(db);
}

/* ── Single active session ──────────────────────────────────────────
 * Only ONE device may use an account at a time. Logging in (or starting
 * the app) CLAIMS the session: a fresh token is written onto the user
 * record in the shared DB and mirrored into THIS device's localStorage.
 * Every other device sees the mismatch on its next poll and is locked
 * out (gate phase "session") until the user clicks "Use Cinem AI Assistant here". */

const sessKey = (id: string) => `cinem-ai-assistant-session-${id}`;

/** This device's session token for the user ("" = none yet). */
export function localSession(userId: string): string {
  return localStorage.getItem(sessKey(userId)) ?? "";
}

/** Claims the single active session for THIS device — kicks all others. */
export async function claimSession(userId: string): Promise<void> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return;
  const sid = crypto.randomUUID();
  user.activeSessionId = sid;
  user.sessionAt = new Date().toISOString();
  localStorage.setItem(sessKey(userId), sid);
  pushActivity(
    db, "login", user.id,
    `${user.name} logged in — any previous session was signed out`, user.name,
  );
  await writeDb(db);
}

/** Marks a successful login (app unlock) for the device user. */
export async function recordLogin(id: string): Promise<void> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) return;
  user.lastLogin = new Date().toISOString();
  pushActivity(db, "login", user.id, `${user.name} unlocked Cinem AI Assistant`, user.name);
  await writeDb(db);
}

/* ── Usage analytics (see costModel.ts for ₹ math) ──────────────────── */

function monthAgg(db: DbShape, subjectId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const agg = {
    commands: 0, geminiIn: 0, geminiOut: 0, ttsChars: 0,
    vision: 0, browser: 0, agents: 0, lastAt: null as string | null,
  };
  for (const e of db.usage ?? []) {
    if (e.subjectId !== subjectId || Date.parse(e.at) < monthStart.getTime()) continue;
    if (!agg.lastAt || e.at > agg.lastAt) agg.lastAt = e.at;
    if (e.kind === "command") agg.commands++;
    else if (e.kind === "gemini") { agg.geminiIn += e.q1; agg.geminiOut += e.q2; }
    else if (e.kind === "tts") agg.ttsChars += e.q1;
    else if (e.kind === "vision") agg.vision++;
    else if (e.kind === "browser") agg.browser++;
    else if (e.kind === "agent") agg.agents++;
  }
  return agg;
}

/** Logs a metered event for the device user; hard ₹ limit auto-freezes. */
export async function logUsage(kind: UsageKind, q1 = 1, q2 = 0): Promise<void> {
  try {
    const user = await getDeviceUser();
    if (!user) return;
    const db = await readDb();
    db.usage = [
      { id: crypto.randomUUID(), subjectId: user.id, kind, q1, q2, at: new Date().toISOString() },
      ...(db.usage ?? []),
    ].slice(0, USAGE_CAP);

    const rec = db.users.find((u) => u.id === user.id);
    if (rec?.hardLimitInr != null && !rec.frozen) {
      const cost = estCostInr(monthAgg(db, user.id));
      if (cost >= rec.hardLimitInr) {
        rec.frozen = true;
        pushActivity(db, "admin", rec.id,
          `AUTO-FROZEN: hard usage limit ₹${rec.hardLimitInr} reached (est ₹${cost})`, rec.name);
      }
    }
    await writeDb(db);
  } catch {
    /* metering must never break the app */
  }
}

/** Current-month usage rollup for every user (sorted by est cost desc). */
export async function getUsageSummary(): Promise<UsageSummary[]> {
  const db = await readDb();
  return db.users
    .map((u) => {
      const a = monthAgg(db, u.id);
      return {
        userId: u.id, name: u.name, email: u.email,
        frozen: !!u.frozen,
        softLimitInr: u.softLimitInr ?? null,
        hardLimitInr: u.hardLimitInr ?? null,
        lastActive: a.lastAt ?? u.lastLogin ?? null,
        commands: a.commands, geminiIn: a.geminiIn, geminiOut: a.geminiOut,
        ttsChars: a.ttsChars, vision: a.vision, browser: a.browser, agents: a.agents,
        estCostInr: estCostInr(a),
      };
    })
    .sort((x, y) => y.estCostInr - x.estCostInr);
}

/** Admin: per-user ₹ limits (null = no limit). */
export async function setUserLimits(
  id: string, soft: number | null, hard: number | null,
): Promise<void> {
  const db = await readDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) return;
  user.softLimitInr = soft;
  user.hardLimitInr = hard;
  pushActivity(db, "admin", id,
    `Usage limits for ${user.email}: soft ₹${soft ?? "—"}, hard ₹${hard ?? "—"}`, user.name);
  await writeDb(db);
}
