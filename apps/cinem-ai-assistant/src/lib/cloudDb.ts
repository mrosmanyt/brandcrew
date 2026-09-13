/**
 * Cinem AI Assistant Cloud backend — Supabase implementation of the user-management API.
 *
 * Mirrors the exact function surface of localDb.ts, so the rest of the app
 * (gate, admin panel, orchestrator) doesn't care which backend is active —
 * the facade in src/lib/db.ts picks cloud when VITE_SUPABASE_URL is set,
 * local JSON otherwise.
 *
 * All database access goes through SECURITY DEFINER RPCs (see
 * supabase/migrations/001_user_management.sql). The anon key can touch no
 * table directly; admin RPCs additionally require the admin credentials,
 * which are kept in sessionStorage after a successful admin login.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  UserRecord, RegistrationInput, ActivityEntry, ActivityType, UsageKind, UsageSummary,
} from "@/lib/localDb";

// Cloud config. Falls back to the live project so EVERY build (even one
// without a .env / CI env vars) connects to the shared Cloud DB — this is
// what makes signups from any machine show up in the admin panel. The anon
// key is a public client key (RLS-protected); safe to ship in the app.
const URL = import.meta.env.VITE_SUPABASE_URL || "https://gevhtxmsamqvdiypiwbb.supabase.co";
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdldmh0eG1zYW1xdmRpeXBpd2JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNjY4MDIsImV4cCI6MjA5Njc0MjgwMn0.bfxqGEJIruNPZfPqf7tn2pF0vkS68IZSKKWdk61Boow";
const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const CLOUD_CONFIGURED = !!URL && !!ANON;

/* ── Client (tauri-http fetch inside the desktop app — no CORS) ────── */

let clientPromise: Promise<SupabaseClient> | null = null;

async function sb(): Promise<SupabaseClient> {
  clientPromise ??= (async () => {
    const fetchImpl = IS_TAURI
      ? (await import("@tauri-apps/plugin-http")).fetch
      : window.fetch.bind(window);
    return createClient(URL, ANON, {
      auth: { persistSession: false },
      global: { fetch: fetchImpl as typeof fetch },
    });
  })();
  return clientPromise;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const client = await sb();
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/* ── Device identity (stable per machine, local-only) ──────────────── */

const DEVICE_ID_KEY = "cinem-ai-assistant-cloud-device";

function deviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** RPCs return UserRecord-shaped jsonb; normalize nulls to undefined. */
function toUser(raw: Record<string, unknown> | null): UserRecord | null {
  if (!raw) return null;
  const u = raw as unknown as UserRecord & { password: string | null };
  return { ...u, password: u.password ?? undefined };
}

/* ── Admin session (credentials for the admin RPCs) ─────────────────── */

const ADMIN_CRED_KEY = "cinem-ai-assistant-admin-cred";

function adminCreds(): { u: string; p: string } {
  try {
    const raw = sessionStorage.getItem(ADMIN_CRED_KEY);
    if (raw) return JSON.parse(raw) as { u: string; p: string };
  } catch { /* fall through */ }
  throw new Error("Admin session expired — log in again.");
}

/* ── User-facing API (same names as localDb) ────────────────────────── */

export async function submitRequest(input: RegistrationInput): Promise<UserRecord> {
  const user = toUser(
    await rpc("submit_registration", {
      p_name: input.name, p_email: input.email,
      p_whatsapp: input.whatsapp, p_country: input.country,
      p_device: deviceId(),
    }),
  );
  if (!user) throw new Error("Registration failed.");
  console.log(`[Cinem AI Assistant] Signup saved to DB (cloud ✓): ${user.email}`);
  return user;
}

export async function getDeviceUser(): Promise<UserRecord | null> {
  return toUser(await rpc("get_device_user", { p_device: deviceId() }));
}

export async function resetDeviceLink(): Promise<void> {
  await rpc("unbind_device", { p_device: deviceId() });
}

export async function recordLogin(_id: string): Promise<void> {
  await rpc("record_login", { p_device: deviceId() }).catch(() => undefined);
}

/* ── Single active session (cloud) ──────────────────────────────────
 * Requires the `claim_session` RPC + `active_session_id` column:
 *
 *   alter table users add column if not exists active_session_id uuid;
 *   alter table users add column if not exists session_at timestamptz;
 *   create or replace function claim_session(p_device text)
 *   returns uuid language plpgsql security definer as $$
 *   declare v_sid uuid := gen_random_uuid();
 *   begin
 *     update users set active_session_id = v_sid, session_at = now()
 *       where id = (select user_id from devices where device = p_device);
 *     return v_sid;
 *   end $$;
 *
 * `get_device_user` must include the column as "activeSessionId" in its
 * jsonb result. Until the migration is applied, claim_session fails and
 * single-session enforcement simply stays off for the cloud backend. */

const sessKey = (id: string) => `cinem-ai-assistant-session-${id}`;

/** This device's session token for the user ("" = none yet). */
export function localSession(userId: string): string {
  return localStorage.getItem(sessKey(userId)) ?? "";
}

/** Claims the single active session for THIS device — kicks all others. */
export async function claimSession(userId: string): Promise<void> {
  try {
    const sid = await rpc<string | null>("claim_session", { p_device: deviceId() });
    if (sid) localStorage.setItem(sessKey(userId), sid);
  } catch (e) {
    console.warn("[Cinem AI Assistant] claim_session RPC unavailable — single-session off (cloud):", e);
  }
}

export async function logActivity(
  type: ActivityType, text: string, _userId?: string | null, _userName?: string,
): Promise<void> {
  // Only command events originate client-side; login/admin/system are
  // written server-side by their RPCs.
  if (type !== "command") return;
  await rpc("log_command", { p_device: deviceId(), p_text: text }).catch(() => undefined);
}

/* ── Usage analytics ─────────────────────────────────────────────────── */

/** Logs a metered event (hard ₹ limit auto-freezes server-side). */
export async function logUsage(kind: UsageKind, q1 = 1, q2 = 0): Promise<void> {
  await rpc("log_usage", { p_device: deviceId(), p_kind: kind, p_q1: q1, p_q2: q2 }).catch(
    () => undefined, // metering must never break the app
  );
}

/** Admin: current-month usage rollup per user (sorted by est cost desc). */
export async function getUsageSummary(): Promise<UsageSummary[]> {
  const { u, p } = adminCreds();
  return ((await rpc<UsageSummary[]>("admin_usage_summary", { p_user: u, p_pass: p })) ?? []);
}

/** Admin: per-user ₹ limits (null = no limit). */
export async function setUserLimits(
  id: string, soft: number | null, hard: number | null,
): Promise<void> {
  const { u, p } = adminCreds();
  await rpc("admin_set_limits", { p_user: u, p_pass: p, p_id: id, p_soft: soft, p_hard: hard });
}

/* ── Admin API ──────────────────────────────────────────────────────── */

export async function verifyAdmin(user: string, pass: string): Promise<boolean> {
  const ok = await rpc<boolean>("admin_check", { p_user: user.trim(), p_pass: pass });
  if (ok) sessionStorage.setItem(ADMIN_CRED_KEY, JSON.stringify({ u: user.trim(), p: pass }));
  return ok;
}

export async function listUsers(): Promise<UserRecord[]> {
  const { u, p } = adminCreds();
  const rows = await rpc<Record<string, unknown>[]>("admin_list_users", { p_user: u, p_pass: p });
  return (rows ?? []).map((r) => toUser(r)!) as UserRecord[];
}

export async function approveUser(id: string): Promise<UserRecord | null> {
  const { u, p } = adminCreds();
  return toUser(await rpc("admin_approve", { p_user: u, p_pass: p, p_id: id }));
}

export async function rejectUser(id: string): Promise<UserRecord | null> {
  const { u, p } = adminCreds();
  return toUser(await rpc("admin_reject", { p_user: u, p_pass: p, p_id: id }));
}

export async function deleteUser(id: string): Promise<void> {
  const { u, p } = adminCreds();
  await rpc("admin_delete", { p_user: u, p_pass: p, p_ids: [id] });
}

export async function bulkDelete(ids: string[]): Promise<void> {
  const { u, p } = adminCreds();
  await rpc("admin_delete", { p_user: u, p_pass: p, p_ids: ids });
}

export async function setFrozen(id: string, frozen: boolean): Promise<void> {
  const { u, p } = adminCreds();
  await rpc("admin_set_frozen", { p_user: u, p_pass: p, p_ids: [id], p_frozen: frozen });
}

export async function bulkSetFrozen(ids: string[], frozen: boolean): Promise<void> {
  const { u, p } = adminCreds();
  await rpc("admin_set_frozen", { p_user: u, p_pass: p, p_ids: ids, p_frozen: frozen });
}

export async function resetPassword(id: string): Promise<string | null> {
  const { u, p } = adminCreds();
  return await rpc<string | null>("admin_reset_password", { p_user: u, p_pass: p, p_id: id });
}

export async function setPaidAmount(id: string, amount: number): Promise<void> {
  const { u, p } = adminCreds();
  await rpc("admin_set_paid", {
    p_user: u, p_pass: p, p_id: id,
    p_amount: Number.isFinite(amount) ? Math.max(0, amount) : 0,
  });
}

export async function updateAdminCredentials(newUser: string, newPass: string): Promise<void> {
  const { u, p } = adminCreds();
  await rpc("admin_update_creds", { p_user: u, p_pass: p, p_new_user: newUser, p_new_pass: newPass });
  // Keep the session valid under the new credentials.
  sessionStorage.setItem(
    ADMIN_CRED_KEY,
    JSON.stringify({ u: newUser.trim() || u, p: newPass || p }),
  );
}

export async function listActivity(opts?: {
  userId?: string; type?: ActivityType; limit?: number;
}): Promise<ActivityEntry[]> {
  const { u, p } = adminCreds();
  const rows = await rpc<ActivityEntry[]>("admin_list_activity", {
    p_user: u, p_pass: p,
    p_subject: opts?.userId ?? null,
    p_limit: opts?.limit ?? 100,
  });
  const items = rows ?? [];
  return opts?.type ? items.filter((a) => a.type === opts.type) : items;
}

export async function clearActivity(): Promise<void> {
  const { u, p } = adminCreds();
  await rpc("admin_clear_activity", { p_user: u, p_pass: p });
}

/* ── License verification (gate / future use) ───────────────────────── */

export interface VerifyResult {
  ok: boolean;
  status?: "active" | "expired";
  plan?: string;
  expires_at?: string | null;
  message: string;
}

export async function verifyLicense(key: string, hardwareId: string): Promise<VerifyResult> {
  try {
    return await rpc<VerifyResult>("verify_license", { p_key: key.trim(), p_hwid: hardwareId });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
