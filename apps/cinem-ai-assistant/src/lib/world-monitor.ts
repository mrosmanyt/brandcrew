/**
 * World Monitor — official live-intel source for Today Headlines + the Live tab.
 *
 * Site: https://www.worldmonitor.app/
 * Digest: GET https://api.worldmonitor.app/api/news/v1/list-feed-digest
 * Docs: https://www.worldmonitor.app/docs/api-reference/newsservice/listfeeddigest
 *
 * The public site sends X-Frame-Options: SAMEORIGIN, so an iframe stays black.
 * CINEM Pro never fakes that embed. Headlines come from the REST digest when a
 * World Monitor API key is present; otherwise Google News / HN fill the same UI.
 *
 * Key (founder): worldmonitor.app → sign in → API / billing for a `wm_…` key.
 * Paste it in Settings → API, or set WORLD_MONITOR_API_KEY / WORLDMONITOR_API_KEY
 * on the desktop process. Do not invent a key.
 */
export const WORLD_MONITOR_SITE = "https://www.worldmonitor.app/";
export const WORLD_MONITOR_DIGEST_URL =
  "https://api.worldmonitor.app/api/news/v1/list-feed-digest?variant=full&lang=en";
export const WORLD_MONITOR_DOCS =
  "https://www.worldmonitor.app/docs/api-reference/newsservice/listfeeddigest";
export const WORLD_MONITOR_AUTH_DOCS = "https://www.worldmonitor.app/docs/usage-auth";

export const WORLD_MONITOR_SETUP =
  "World Monitor’s official digest needs a wm_… API key. Add it in Settings → API, or set WORLD_MONITOR_API_KEY on the desktop app. Until then, CINEM Pro shows a live public news feed in this same panel.";

export type WorldMonitorItem = {
  title: string;
  source: string;
  link: string;
  publishedAt: number;
  category: string;
};

type DigestBucket = {
  items?: Array<{
    title?: string;
    source?: string;
    link?: string;
    publishedAt?: number;
  }>;
};

export function parseWorldMonitorDigest(raw: unknown): WorldMonitorItem[] {
  if (!raw || typeof raw !== "object") return [];
  const root = raw as { categories?: Record<string, DigestBucket>; data?: { categories?: Record<string, DigestBucket> } };
  const categories = root.categories || root.data?.categories;
  if (!categories || typeof categories !== "object") return [];
  const out: WorldMonitorItem[] = [];
  for (const [category, bucket] of Object.entries(categories)) {
    const items = bucket && typeof bucket === "object" ? bucket.items : undefined;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const title = String(item?.title || "").trim();
      if (!title) continue;
      out.push({
        title,
        source: String(item?.source || "World Monitor").trim() || "World Monitor",
        link: String(item?.link || "").trim(),
        publishedAt: typeof item?.publishedAt === "number" ? item.publishedAt : Date.now(),
        category,
      });
    }
  }
  return out.sort((a, b) => b.publishedAt - a.publishedAt);
}

export function worldMonitorTag(category: string): string {
  const c = category.toLowerCase();
  if (/(tech|cyber|ai)/.test(c)) return "TECH";
  if (/(finance|market|commodit)/.test(c)) return "FINANCE";
  if (/(science|health|climate)/.test(c)) return "SCIENCE";
  if (/(sport)/.test(c)) return "SPORT";
  return "WORLD";
}
