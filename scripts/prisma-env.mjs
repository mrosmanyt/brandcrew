/** Shared Postgres URL helpers for generate / local ensure. */
export const LOCAL_DATABASE_URL =
  "postgresql://brandcrew:brandcrew@127.0.0.1:5432/brandcrew?schema=public";

export function isFileDatabaseUrl(url) {
  const value = (url || "").trim().replace(/^["']|["']$/g, "");
  return !value || value.startsWith("file:") || value.startsWith("sqlite:");
}

export function generateSafeDatabaseUrl() {
  const url = (process.env.DATABASE_URL || "").trim();
  if (isFileDatabaseUrl(url)) return LOCAL_DATABASE_URL;
  return url;
}

export function generateSafeDirectUrl(databaseUrl) {
  const url = (process.env.DIRECT_URL || "").trim();
  if (isFileDatabaseUrl(url)) return databaseUrl;
  return url;
}

export function prismaGenerateEnv() {
  const DATABASE_URL = generateSafeDatabaseUrl();
  const DIRECT_URL = generateSafeDirectUrl(DATABASE_URL);
  return { ...process.env, DATABASE_URL, DIRECT_URL };
}
