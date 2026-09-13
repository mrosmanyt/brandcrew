/**
 * Local user gate state machine — fully offline (replaces the Supabase
 * auth + license stores).
 *
 * phases:
 *   checking — reading local DB on startup (license check on every start)
 *   register — first run: show registration form
 *   pending  — request saved; waiting for admin approval (auto-polls)
 *   rejected — admin rejected the request
 *   frozen   — admin froze this account (login disabled; auto-polls)
 *   password — admin set/reset an access password; enter it once per device
 *   session  — account was logged in on ANOTHER device (single-session kick)
 *   unlocked — approved: full app available (poll catches freezes/takeovers)
 */
import { create } from "zustand";
import {
  submitRequest, getDeviceUser, resetDeviceLink, recordLogin,
  claimSession, localSession,
  type UserRecord, type RegistrationInput,
} from "@/lib/db";

export type UserPhase =
  | "checking" | "register" | "pending" | "rejected" | "frozen" | "password"
  | "session" | "unlocked";

const PENDING_POLL_MS = 4000;   // waiting for approval → react fast
const UNLOCKED_POLL_MS = 10000; // catch freezes + session takeovers fast
let pollTimer: ReturnType<typeof setInterval> | null = null;

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPoll(ms: number) {
  stopPoll();
  pollTimer = setInterval(() => void useUserStore.getState().checkNow(), ms);
}

/* Device-side "password already entered" marker. Re-prompts automatically
   after an admin reset because the stored value no longer matches. */
const passKey = (id: string) => `cinem-ai-assistant-pass-${id}`;
const passOk = (u: UserRecord) =>
  !u.password || localStorage.getItem(passKey(u.id)) === u.password;

/* Single-session check: the shared DB holds the ONE allowed session token.
   If it exists and doesn't match this device's token, another device logged
   in after us → this session is dead. */
const sessionOk = (u: UserRecord) =>
  !u.activeSessionId || u.activeSessionId === localSession(u.id);

function phaseFor(user: UserRecord | null): UserPhase {
  if (!user) return "register";
  if (user.status === "rejected") return "rejected";
  if (user.status === "pending") return "pending";
  // approved:
  if (user.frozen) return "frozen";
  if (!passOk(user)) return "password";
  if (!sessionOk(user)) return "session";
  return "unlocked";
}

const pollFor = (phase: UserPhase): number | null =>
  phase === "pending" || phase === "frozen" ? PENDING_POLL_MS
  : phase === "unlocked" ? UNLOCKED_POLL_MS
  : null;

interface UserState {
  phase: UserPhase;
  user: UserRecord | null;
  message: string;
  busy: boolean;
  justUnlocked: boolean; // triggers confetti once

  /** License check — runs on every app start. */
  init: () => Promise<void>;
  register: (input: RegistrationInput) => Promise<void>;
  /** Re-reads the local DB (poll + "Check status" button). */
  checkNow: () => Promise<void>;
  /** Validates the admin-set access password (once per device). */
  submitPassword: (pass: string) => void;
  /** Session was taken by another device → reclaim it HERE (kicks the other). */
  takeOver: () => Promise<void>;
  /** After rejection (or to switch accounts): unbind device → register again. */
  registerAgain: () => Promise<void>;
  clearUnlockFlag: () => void;
}

function applyPhase(
  set: (p: Partial<UserState>) => void,
  user: UserRecord | null,
  prevPhase: UserPhase,
) {
  const phase = phaseFor(user);
  const justUnlocked = phase === "unlocked" && prevPhase !== "unlocked";
  set({ user, phase, ...(justUnlocked ? { justUnlocked: true } : {}) });
  if (justUnlocked && user) {
    // Sequenced (both rewrite the DB): record the login, then — on the very
    // first unlock (e.g. admin just approved) — register this device as the
    // single active session so later logins elsewhere kick correctly.
    void (async () => {
      await recordLogin(user.id).catch(() => undefined);
      if (!user.activeSessionId) await claimSession(user.id).catch(() => undefined);
    })();
  }
  const ms = pollFor(phase);
  if (ms) startPoll(ms);
  else stopPoll();
  return phase;
}

export const useUserStore = create<UserState>((set, get) => ({
  phase: "checking",
  user: null,
  message: "",
  busy: false,
  justUnlocked: false,

  init: async () => {
    try {
      let user = await getDeviceUser();
      // App start = a login → CLAIM the single active session. Any session
      // on another device is invalidated (it kicks on its next poll).
      if (user && user.status === "approved" && !user.frozen && passOk(user)) {
        await claimSession(user.id);
        user = (await getDeviceUser()) ?? user;
      }
      // No confetti on a normal startup of an already-approved user.
      set({ message: "" });
      const phase = phaseFor(user);
      set({ user, phase });
      if (phase === "unlocked" && user) void recordLogin(user.id);
      const ms = pollFor(phase);
      if (ms) startPoll(ms);
    } catch (e) {
      console.error("[Cinem AI Assistant] local DB unreadable:", e);
      set({ phase: "register", message: "Local database could not be read — please register." });
    }
  },

  register: async (input) => {
    if (!input.name.trim() || !input.email.trim()) {
      set({ message: "Name and email are required." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      set({ message: "Please enter a valid email address." });
      return;
    }
    set({ busy: true, message: "" });
    try {
      const user = await submitRequest(input);
      set({ busy: false });
      const phase = applyPhase(set, user, get().phase);
      if (phase === "pending") set({ message: "Request sent to admin. Waiting for approval." });
    } catch (e) {
      set({ busy: false, message: e instanceof Error ? e.message : String(e) });
    }
  },

  checkNow: async () => {
    try {
      const user = await getDeviceUser();
      applyPhase(set, user, get().phase);
    } catch {
      /* transient read failure — retry next poll */
    }
  },

  submitPassword: (pass) => {
    const user = get().user;
    if (!user?.password) return;
    if (pass.trim() === user.password) {
      localStorage.setItem(passKey(user.id), user.password);
      set({ message: "" });
      // Correct password = a login → claim the single active session
      // (signs out any other device), then re-read and unlock.
      void (async () => {
        await claimSession(user.id);
        const fresh = (await getDeviceUser()) ?? user;
        applyPhase(set, fresh, get().phase);
      })();
    } else {
      set({ message: "Incorrect password. Ask the admin for your access password." });
    }
  },

  takeOver: async () => {
    const user = get().user;
    if (!user) return;
    set({ busy: true, message: "" });
    try {
      await claimSession(user.id);
      const fresh = (await getDeviceUser()) ?? user;
      applyPhase(set, fresh, get().phase);
    } finally {
      set({ busy: false });
    }
  },

  registerAgain: async () => {
    stopPoll();
    await resetDeviceLink();
    set({ phase: "register", user: null, message: "" });
  },

  clearUnlockFlag: () => set({ justUnlocked: false }),
}));
