/**
 * Supabase client. If env vars are absent the panel runs in DEMO MODE
 * (in-memory sample data) so it works out-of-the-box before backend setup.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const IS_DEMO = !url || !anon;

export const supabase: SupabaseClient | null = IS_DEMO
  ? null
  : createClient(url, anon);
