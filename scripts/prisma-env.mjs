/** Shared Postgres URL helpers for generate / local ensure. */
export const LOCAL_DATABASE_URL =
  "postgresql://brandcrew:brandcrew@127.0.0.1:5432/brandcrew?schema=public";

/** Trim whitespace and strip a single pair of wrapping quotes. */
function normalizeDatabaseUrl(url) {
  return String(url ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

export function isFileDatabaseUrl(url) {
  const value = normalizeDatabaseUrl(url);
  return !value || value.startsWith("file:") || value.startsWith("sqlite:");
}

export function generateSafeDatabaseUrl() {
  const url = normalizeDatabaseUrl(process.env.DATABASE_URL);
  if (isFileDatabaseUrl(url)) return LOCAL_DATABASE_URL;
  return url;
}

/**
 * Prisma schema requires DIRECT_URL. Vercel often creates the var blank while
 * DATABASE_URL is set (Neon). Missing / whitespace / file: must fall back —
 * never return "".
 */
export function generateSafeDirectUrl(databaseUrl) {
  const url = normalizeDatabaseUrl(process.env.DIRECT_URL);
  const fallback =
    normalizeDatabaseUrl(databaseUrl) ||
    generateSafeDatabaseUrl() ||
    LOCAL_DATABASE_URL;
  if (!url || isFileDatabaseUrl(url)) return fallback;
  return url;
}

export function prismaGenerateEnv() {
  const DATABASE_URL = generateSafeDatabaseUrl();
  const DIRECT_URL = generateSafeDirectUrl(DATABASE_URL);
  return { ...process.env, DATABASE_URL, DIRECT_URL };
}
