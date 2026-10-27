import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isSupabaseAuthEnabled,
  supabaseAnonKey,
  supabaseUrl,
} from "@/lib/supabase/env";

/** Server Supabase client bound to the request cookie jar. */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseAuthEnabled()) return null;
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll from a Server Component — session refresh happens in proxy.
        }
      },
    },
  });
}
