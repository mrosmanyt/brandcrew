/**
 * Admin authentication — Supabase Auth email/password.
 * Required in live mode: RLS grants table access to the `authenticated`
 * role, so the admin must sign in before the anon key can read/write data.
 * Bypassed entirely in DEMO MODE.
 */
import { create } from "zustand";
import { supabase, IS_DEMO } from "@/lib/supabase";

interface AuthState {
  ready: boolean; // initial session check finished
  authed: boolean;
  email: string | null;
  error: string | null;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  ready: false,
  authed: IS_DEMO, // demo mode needs no login
  email: null,
  error: null,

  init: async () => {
    if (IS_DEMO || !supabase) {
      set({ ready: true, authed: true });
      return;
    }
    const { data } = await supabase.auth.getSession();
    set({ ready: true, authed: !!data.session, email: data.session?.user.email ?? null });

    // Keep state in sync with token refresh / sign-out.
    supabase.auth.onAuthStateChange((_e, session) => {
      set({ authed: !!session, email: session?.user.email ?? null });
    });
  },

  signIn: async (email, password) => {
    set({ error: null });
    if (!supabase) return;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ error: error.message });
      return;
    }
    set({ authed: true, email: data.user?.email ?? null });
  },

  signOut: async () => {
    if (supabase) await supabase.auth.signOut();
    set({ authed: false, email: null });
  },
}));
