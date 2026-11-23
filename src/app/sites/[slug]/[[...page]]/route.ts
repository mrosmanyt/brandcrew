import { servePublishedSitePage } from "@/lib/site-serving";
import { recordSiteVisitSafe } from "@/lib/site-builder";

export const dynamic = "force-dynamic";

type Ctx = {
  params: Promise<{ slug: string; page?: string[] }>;
};

/**
 * Public face of a published builder site (Package 11d). Reached either
 * directly (app.cinem.tech/sites/<slug>) or by proxy rewrite from the
 * site's own subdomain (<slug>.cinem.tech). Always public — a published
 * site is meant to be shared — and always the pinned published version.
 * Successful serves count as a visit (Package H; bots filtered,
 * fail-safe — counting never breaks a serve).
 */
export async function GET(request: Request, context: Ctx) {
  const { slug, page } = await context.params;
  const pagePath = (page ?? []).join("/");
  const served = await servePublishedSitePage(slug, pagePath);
  if (served.status === 200 && served.projectId) {
    await recordSiteVisitSafe({
      projectId: served.projectId,
      path: pagePath,
      userAgent: request.headers.get("user-agent"),
    });
  }
  return new Response(served.html, {
    status: served.status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control":
        served.status === 200
          ? "public, max-age=0, s-maxage=60, stale-while-revalidate=120"
          : "no-store",
    },
  });
}
