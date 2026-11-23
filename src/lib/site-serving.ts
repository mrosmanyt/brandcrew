import { sanitizeBuilderPreviewHtml } from "@/lib/html-preview";
import {
  applyWhatsAppButton,
  injectSeoMeta,
  normalizeSitePagePath,
  publishedSitePath,
  publishedSiteUrl,
  rewriteSiteLinks,
  siteTemplateById,
} from "@/lib/site-builder-pure";
import { publishedPageSeo, resolvePublishedSite } from "@/lib/site-builder";

/**
 * Serving for published builder sites (Package 11d). One entry point
 * feeds both public faces of a published site:
 * - https://<slug>.cinem.tech/ (proxy rewrites the host to /sites/<slug>)
 * - https://app.cinem.tech/sites/<slug>
 * The pinned published version is what renders — draft edits never leak
 * to the live site. The HTML passes the same sanitizer as the builder
 * preview (inline interactivity kept, external code stripped).
 */

export type ServedSitePage = {
  status: number;
  html: string;
  projectId: string | null;
};

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Site not found — CINEM Pro</title>
<style>body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:#faf9f7;color:#1a1915;display:flex;min-height:100vh;align-items:center;justify-content:center}main{max-width:26rem;padding:2rem;text-align:center}h1{font-size:1.35rem;margin:0 0 .5rem}p{color:#5c5952;line-height:1.6;margin:0}</style>
</head><body><main>
<h1>This site isn&rsquo;t live</h1>
<p>The address may be wrong, or the owner hasn&rsquo;t published this website yet.</p>
</main></body></html>`;

export function siteNotFoundPage(): ServedSitePage {
  return { status: 404, html: NOT_FOUND_HTML, projectId: null };
}

/**
 * Resolve and render one page of a published site. `pagePath` is the
 * path inside the site ("" = home). In-site links are rewritten to the
 * /sites/<slug> base so the same HTML works on the site's subdomain
 * (via the proxy rewrite) and on the app host's path form alike.
 */
export async function servePublishedSitePage(
  slug: string,
  pagePath: string,
): Promise<ServedSitePage> {
  const site = await resolvePublishedSite(slug);
  if (!site) return siteNotFoundPage();
  const normalized = normalizeSitePagePath(pagePath);
  if (normalized === null) return siteNotFoundPage();
  const pages = site.pages ?? [];
  let rawHtml: string | null = null;
  if (normalized === "") {
    rawHtml = site.html;
  } else {
    rawHtml = pages.find((page) => page.path === normalized)?.html ?? null;
  }
  if (rawHtml === null) return siteNotFoundPage();
  const knownPaths = new Set(["", ...pages.map((page) => page.path)]);
  const base = publishedSitePath(slug);
  const canonicalBase = publishedSiteUrl(slug);
  const seo = publishedPageSeo({
    settings: site.settings ?? null,
    title: site.title,
    templateLabel: siteTemplateById(site.template)?.label,
    canonicalUrl: pagePath ? `${canonicalBase}${pagePath}` : canonicalBase,
  });
  const withSeo = injectSeoMeta(sanitizeBuilderPreviewHtml(rawHtml), seo);
  const withButton = applyWhatsAppButton(withSeo, {
    number: site.settings?.whatsappNumber ?? null,
    enabled: site.settings?.whatsappEnabled ?? true,
  });
  const html = rewriteSiteLinks(
    withButton,
    (path) => (path ? `${base}/${path}` : base),
    knownPaths,
  );
  return { status: 200, html, projectId: site.projectId };
}
