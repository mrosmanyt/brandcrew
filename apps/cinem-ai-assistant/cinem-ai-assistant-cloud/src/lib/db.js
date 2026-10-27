import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";
import { PLANS } from "./credits.js";

/**
 * Data layer — do drivers:
 *  - mock  : in-memory (CINEM-AI-ASSISTANT_MOCK=1) — bina Supabase ke local test
 *  - real  : Supabase (service role) — schema: supabase/migration.sql
 * Multi-tenant rule: HAR query user_id se scoped hai. Client A kabhi
 * client B ka data na dekhe (Blueprint hard gate #2).
 */

const err = (status, message) => Object.assign(new Error(message), { status });

// ── Mock driver ────────────────────────────────────────────────────
const mem = {
  profiles: new Map(),   // userId -> profile
  accounts: new Map(),   // `${userId}:${platform}` -> account
  jobs: new Map(),       // jobId -> job
  usage: [],             // events
  tgLinks: new Map(),    // chatId -> userId
  linkCodes: new Map(),  // code -> { userId, exp }
};

function mockProfile(userId) {
  if (!mem.profiles.has(userId)) {
    mem.profiles.set(userId, {
      id: userId,
      email: `${userId}@mock.local`,
      plan: "pro",
      credits: 20,
      telegram_chat_id: null,
      created_at: new Date().toISOString(),
    });
  }
  return mem.profiles.get(userId);
}

const mockDb = {
  async getProfile(userId) { return { ...mockProfile(userId) }; },

  async spendCredits(userId, amount) {
    const p = mockProfile(userId);
    if (p.credits < amount) throw err(402, `Credits kam hain (balance: ${p.credits}, chahiye: ${amount}). Plan upgrade ya top-up karein.`);
    p.credits -= amount;
    return p.credits;
  },

  async refundCredits(userId, amount) {
    const p = mockProfile(userId);
    p.credits += amount;
    return p.credits;
  },

  async addUsage(userId, event) {
    mem.usage.push({ id: randomUUID(), user_id: userId, created_at: new Date().toISOString(), ...event });
  },

  async listUsage(userId, limit = 50) {
    return mem.usage.filter((e) => e.user_id === userId).slice(-limit).reverse();
  },

  async createJob(job) { mem.jobs.set(job.id, job); return job; },

  async updateJob(jobId, patch) {
    const j = mem.jobs.get(jobId);
    if (!j) throw err(404, "Job nahi mili");
    Object.assign(j, patch, { updated_at: new Date().toISOString() });
    return j;
  },

  async getJob(jobId) { return mem.jobs.get(jobId) || null; },

  async listJobs(userId, limit = 30) {
    return [...mem.jobs.values()]
      .filter((j) => j.user_id === userId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit);
  },

  async saveAccount(acc) {
    mem.accounts.set(`${acc.user_id}:${acc.platform}`, { ...acc, connected_at: new Date().toISOString() });
  },

  async getAccount(userId, platform) { return mem.accounts.get(`${userId}:${platform}`) || null; },

  async listAccounts(userId) {
    return [...mem.accounts.values()].filter((a) => a.user_id === userId)
      .map(({ refresh_token_enc, ...pub }) => pub); // token kabhi bahar nahi
  },

  async deleteAccount(userId, platform) { mem.accounts.delete(`${userId}:${platform}`); },

  async setTelegramChat(userId, chatId) {
    mockProfile(userId).telegram_chat_id = String(chatId);
    mem.tgLinks.set(String(chatId), userId);
  },

  async getUserByTelegramChat(chatId) { return mem.tgLinks.get(String(chatId)) || null; },

  async createLinkCode(userId) {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    mem.linkCodes.set(code, { userId, exp: Date.now() + 15 * 60 * 1000 });
    return code;
  },

  async consumeLinkCode(code) {
    const item = mem.linkCodes.get(String(code).toUpperCase());
    if (!item || item.exp < Date.now()) return null;
    mem.linkCodes.delete(String(code).toUpperCase());
    return item.userId;
  },
};

// ── Supabase driver ────────────────────────────────────────────────
let sb = null;
export function supa() {
  if (!sb) sb = createClient(config.supabaseUrl, config.supabaseServiceKey, { auth: { persistSession: false } });
  return sb;
}

const one = ({ data, error }) => { if (error) throw err(500, error.message); return data; };

const realDb = {
  async getProfile(userId) {
    const data = one(await supa().from("profiles").select("*").eq("id", userId).maybeSingle());
    if (!data) throw err(404, "Profile nahi mila — pehle login/signup karein");
    return data;
  },

  // Atomic — SQL function race conditions se bachata hai (do jobs ek saath).
  async spendCredits(userId, amount) {
    const { data, error } = await supa().rpc("spend_credits", { p_user: userId, p_amount: amount });
    if (error) {
      if (/insufficient/i.test(error.message)) throw err(402, "Credits kam hain. Plan upgrade ya top-up karein.");
      throw err(500, error.message);
    }
    return data; // naya balance
  },

  async refundCredits(userId, amount) {
    const { data, error } = await supa().rpc("add_credits", { p_user: userId, p_amount: amount });
    if (error) throw err(500, error.message);
    return data;
  },

  async addUsage(userId, event) {
    one(await supa().from("usage_events").insert({ user_id: userId, kind: event.kind, credits: event.credits ?? 0, meta: event.meta ?? {}, job_id: event.job_id ?? null }).select().single());
  },

  async listUsage(userId, limit = 50) {
    return one(await supa().from("usage_events").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit)) || [];
  },

  async createJob(job) {
    return one(await supa().from("jobs").insert(job).select().single());
  },

  async updateJob(jobId, patch) {
    return one(await supa().from("jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", jobId).select().single());
  },

  async getJob(jobId) {
    return one(await supa().from("jobs").select("*").eq("id", jobId).maybeSingle());
  },

  async listJobs(userId, limit = 30) {
    return one(await supa().from("jobs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit)) || [];
  },

  async saveAccount(acc) {
    one(await supa().from("social_accounts").upsert(acc, { onConflict: "user_id,platform" }).select().single());
  },

  async getAccount(userId, platform) {
    return one(await supa().from("social_accounts").select("*").eq("user_id", userId).eq("platform", platform).maybeSingle());
  },

  async listAccounts(userId) {
    const rows = one(await supa().from("social_accounts").select("user_id,platform,channel_id,channel_title,scopes,connected_at").eq("user_id", userId)) || [];
    return rows;
  },

  async deleteAccount(userId, platform) {
    one(await supa().from("social_accounts").delete().eq("user_id", userId).eq("platform", platform).select());
  },

  async setTelegramChat(userId, chatId) {
    one(await supa().from("profiles").update({ telegram_chat_id: String(chatId) }).eq("id", userId).select().single());
  },

  async getUserByTelegramChat(chatId) {
    const data = one(await supa().from("profiles").select("id").eq("telegram_chat_id", String(chatId)).maybeSingle());
    return data?.id || null;
  },

  async createLinkCode(userId) {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    one(await supa().from("telegram_link_codes").insert({ code, user_id: userId, expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() }).select().single());
    return code;
  },

  async consumeLinkCode(code) {
    const data = one(await supa().from("telegram_link_codes").delete().eq("code", String(code).toUpperCase()).gt("expires_at", new Date().toISOString()).select().maybeSingle());
    return data?.user_id || null;
  },
};

export const db = config.mock ? mockDb : realDb;
export { PLANS };
export const newId = () => randomUUID();
