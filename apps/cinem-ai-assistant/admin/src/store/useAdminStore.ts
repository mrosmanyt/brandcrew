/**
 * Admin data store — one façade over Supabase (live) or demo data.
 * All mutations update local state optimistically and persist to Supabase
 * when configured.
 */
import { create } from "zustand";
import { supabase, IS_DEMO } from "@/lib/supabase";
import { DEMO_USERS, DEMO_LICENSES, DEMO_REQUESTS, DEMO_LOGS } from "@/lib/demoData";
import { generateLicenseKey } from "@/lib/utils";
import type {
  AppUser, License, RegistrationRequest, UsageLog,
  UserStatus, LicensePlan, Stats,
} from "@/lib/types";
export type { Stats };

/**
 * Pure stats calculator. Kept OUT of any Zustand selector — computing it
 * inside a selector returns a new object every render and causes an
 * infinite re-render loop. Call it via useMemo in components instead.
 */
export function computeStats(users: AppUser[], licenses: License[], logs: UsageLog[]): Stats {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return {
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.status === "active").length,
    revenue: licenses
      .filter((l) => l.status === "active" || l.status === "expired")
      .reduce((sum, l) => sum + Number(l.price), 0),
    commandsToday: logs.filter((g) => new Date(g.created_at) >= startOfDay).length,
  };
}

interface AdminState {
  loading: boolean;
  error: string | null;
  users: AppUser[];
  licenses: License[];
  requests: RegistrationRequest[];
  logs: UsageLog[];

  clearError: () => void;
  load: () => Promise<void>;

  createUser: (u: { name: string; email: string; whatsapp: string; country: string; password: string }) => Promise<boolean>;
  setUserStatus: (id: string, status: UserStatus) => Promise<void>;
  generateLicense: (plan: LicensePlan, price: number, days: number | null, email?: string) => Promise<License>;
  revokeLicense: (id: string) => Promise<void>;
  resolveRequest: (id: string, approve: boolean) => Promise<License | null>;
}

const PLAN_PRICE: Record<LicensePlan, number> = { lifetime: 199, yearly: 89, monthly: 12 };

export const useAdminStore = create<AdminState>((set, get) => ({
  loading: true,
  error: null,
  users: [],
  licenses: [],
  requests: [],
  logs: [],

  clearError: () => set({ error: null }),

  load: async () => {
    set({ loading: true, error: null });
    if (IS_DEMO || !supabase) {
      set({
        users: DEMO_USERS, licenses: DEMO_LICENSES,
        requests: DEMO_REQUESTS, logs: DEMO_LOGS, loading: false,
      });
      return;
    }
    // Users now come from the auth-backed `profiles` table. Licenses & logs
    // remain optional; registration_requests is retired.
    const [u, l, g] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("licenses").select("*").order("created_at", { ascending: false }),
      supabase.from("usage_logs").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    const users: AppUser[] = (u.data ?? []).map((p: Record<string, unknown>) => ({
      id: String(p.id),
      name: (p.name as string) ?? "",
      email: (p.email as string) ?? "",
      whatsapp: (p.whatsapp as string) ?? "",
      country: (p.country as string) ?? "",
      status: (p.status as UserStatus) ?? "active",
      created_at: (p.created_at as string) ?? new Date().toISOString(),
      last_active: (p.last_active as string) ?? null,
      commands_used: (p.commands_used as number) ?? 0,
      top_agents: (p.top_agents as string[]) ?? [],
    }));
    // Profiles failing usually means RLS / not signed in as an admin.
    const firstErr = u.error ?? l.error ?? g.error;
    set({
      users,
      licenses: (l.data as License[]) ?? [],
      requests: [],
      logs: (g.data as UsageLog[]) ?? [],
      error: u.error
        ? `Load failed: ${u.error.message} (are you signed in as an admin?)`
        : firstErr
          ? `Partial load: ${firstErr.message}`
          : null,
      loading: false,
    });
  },

  createUser: async (input) => {
    // Demo mode → just add locally.
    if (IS_DEMO || !supabase) {
      set((s) => ({
        users: [{
          id: crypto.randomUUID(),
          name: input.name, email: input.email, whatsapp: input.whatsapp,
          country: input.country, status: "active",
          created_at: new Date().toISOString(), last_active: null,
          commands_used: 0, top_agents: [],
        }, ...s.users],
      }));
      return true;
    }
    // Live → create the auth user (email+password) via the secure edge function.
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: {
        name: input.name, email: input.email, whatsapp: input.whatsapp,
        country: input.country, password: input.password,
      },
    });

    if (error) {
      // FunctionsHttpError carries the Response in `context` — read our JSON
      // body so the real reason (e.g. "Admin access required") is shown
      // instead of the generic "non-2xx status code" / fetch message.
      let detail = error.message;
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body?.message) detail = body.message;
        } catch {
          /* keep generic message */
        }
      }
      set({ error: `User not created: ${detail}` });
      return false;
    }

    const result = data as { ok?: boolean; id?: string; message?: string } | null;
    if (!result?.ok) {
      set({ error: `User not created: ${result?.message ?? "unknown error"}` });
      return false;
    }
    // Reflect immediately; a reload will pull the canonical row.
    set((s) => ({
      users: [{
        id: result.id ?? crypto.randomUUID(),
        name: input.name, email: input.email, whatsapp: input.whatsapp,
        country: input.country, status: "active",
        created_at: new Date().toISOString(), last_active: null,
        commands_used: 0, top_agents: [],
      }, ...s.users],
    }));
    return true;
  },

  setUserStatus: async (id, status) => {
    const prev = get().users.find((u) => u.id === id)?.status;
    set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, status } : u)) }));
    if (!IS_DEMO && supabase) {
      const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
      if (error) {
        // roll back the optimistic change and surface the problem
        set((s) => ({
          users: s.users.map((u) => (u.id === id && prev ? { ...u, status: prev } : u)),
          error: `Update failed: ${error.message}`,
        }));
      }
    }
  },

  generateLicense: async (plan, price, days, email) => {
    const lic: License = {
      id: crypto.randomUUID(),
      key: generateLicenseKey(),
      user_email: email ?? null,
      plan,
      price: price || PLAN_PRICE[plan],
      hardware_id: null,
      status: "unused",
      created_at: new Date().toISOString(),
      expires_at: days ? new Date(Date.now() + days * 864e5).toISOString() : null,
    };
    if (!IS_DEMO && supabase) {
      const { id: _omit, ...row } = lic;
      void _omit;
      const { data, error } = await supabase.from("licenses").insert(row).select().single();
      if (error) {
        // e.g. assigning to an email that isn't a registered user (FK violation)
        set({ error: `License not created: ${error.message}` });
        throw new Error(error.message);
      }
      const saved = (data as License) ?? lic;
      set((s) => ({ licenses: [saved, ...s.licenses] }));
      return saved;
    }
    set((s) => ({ licenses: [lic, ...s.licenses] }));
    return lic;
  },

  revokeLicense: async (id) => {
    set((s) => ({ licenses: s.licenses.map((l) => (l.id === id ? { ...l, status: "revoked" } : l)) }));
    if (!IS_DEMO && supabase) {
      const { error } = await supabase.from("licenses").update({ status: "revoked" }).eq("id", id);
      if (error) set({ error: `Revoke failed: ${error.message}` });
    }
  },

  resolveRequest: async (id, approve) => {
    const req = get().requests.find((r) => r.id === id);
    set((s) => ({ requests: s.requests.filter((r) => r.id !== id) }));
    if (!IS_DEMO && supabase) {
      await supabase
        .from("registration_requests")
        .update({ status: approve ? "approved" : "declined" })
        .eq("id", id);
    }
    if (!approve || !req) return null;

    // Approve → create user FIRST (license FK references the user's email),
    // then generate a lifetime license bound to that email.
    const newUser: AppUser = {
      id: crypto.randomUUID(),
      name: req.name, email: req.email, whatsapp: req.whatsapp,
      country: req.country, status: "active",
      created_at: new Date().toISOString(), last_active: null,
      commands_used: 0, top_agents: [],
    };
    if (!IS_DEMO && supabase) {
      const { id: _omit, ...row } = newUser;
      void _omit;
      // upsert on email → re-approving an existing email won't crash
      const { data, error } = await supabase
        .from("app_users")
        .upsert(row, { onConflict: "email" })
        .select()
        .single();
      if (error) {
        set({ error: `User not created: ${error.message}` });
        return null;
      }
      set((s) => ({ users: [(data as AppUser) ?? newUser, ...s.users] }));
    } else {
      set((s) => ({ users: [newUser, ...s.users] }));
    }
    return get().generateLicense("lifetime", PLAN_PRICE.lifetime, null, req.email);
  },
}));
