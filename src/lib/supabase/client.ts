"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseAuthEnabled, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

let browserClient: SupabaseClient | null = null;

/** Browser Supabase client. Null when env is not configured. */
export function createSupabaseBrowserClient() {
  if (!isSupabaseAuthEnabled()) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl(), supabaseAnonKey());
  }
  return browserClient;
}
