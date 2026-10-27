import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  isSupabaseAdminEnabled,
  supabaseServiceRoleKey,
  supabaseUrl,
} from "@/lib/supabase/env";

let adminClient: SupabaseClient | null = null;

/** Service-role client — server only. Never import from client components. */
export function createSupabaseAdminClient(): SupabaseClient | null {
  if (!isSupabaseAdminEnabled()) return null;
  if (!adminClient) {
    adminClient = createClient(supabaseUrl(), supabaseServiceRoleKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminClient;
}
