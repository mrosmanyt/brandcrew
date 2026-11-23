import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";
import { listPublishedSiteUrlsSafe } from "@/lib/site-builder";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteOrigin();
  const lastModified = new Date();
  // Published builder sites (Package G) join the sitemap on their
  // canonical subdomains. Fail-safe: no entries until tables exist.
  const publishedSites = (await listPublishedSiteUrlsSafe()).map((entry) => ({
    url: entry.url,
    lastModified: entry.lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  return [
    { url: base, lastModified, changeFrequency: "weekly", priority: 1 },
    {
      url: `${base}/about`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${base}/signup`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/login`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/cinem-ai-assistant`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${base}/cinem-ai-assistant/billing`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${base}/chat`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/download`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${base}/billing`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${base}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${base}/dpa`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    ...publishedSites,
  ];
}
