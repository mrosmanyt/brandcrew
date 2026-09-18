/** Supabase project configuration (no secrets in client bundles except anon key). */

export const SUPABASE_PROJECT_REF = "viejyuiiyjmhxfhyuvpa";

export function supabaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    `https://${SUPABASE_PROJECT_REF}.supabase.co`
  );
}

export function supabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
}

export function supabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
}

/** True when public URL + anon key are set — browser and server auth use Supabase. */
export function isSupabaseAuthEnabled() {
  return Boolean(supabaseUrl() && supabaseAnonKey());
}

/** True when service role is available (server-only profile sync, admin auth ops). */
export function isSupabaseAdminEnabled() {
  return isSupabaseAuthEnabled() && Boolean(supabaseServiceRoleKey());
}

export function supabaseAuthCookiePrefix() {
  return `sb-${SUPABASE_PROJECT_REF}-auth-token`;
}

export function hasSupabaseAuthCookie(
  cookies: { name: string; value: string }[],
) {
  const prefix = supabaseAuthCookiePrefix();
  return cookies.some(
    (cookie) => cookie.name === prefix || cookie.name.startsWith(`${prefix}.`),
  );
}
