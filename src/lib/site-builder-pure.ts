import type { PlanId } from "@/lib/constants";

/**
 * Plan-id normalization mirroring src/lib/limits.ts normalizePlanId
 * (kept local so this module stays free of the database import chain
 * and can run in the check script — the mapping is five stable cases).
 */
function normalizeSitePlanId(plan?: string | null): PlanId {
  if (plan === "ultra") return "ultra";
  if (plan === "growth" || plan === "pro") return "pro";
  if (plan === "starter" || plan === "demo") return plan;
  return "demo";
}

/**
 * Website builder (Package 11b) — pure data and rules shared by the
 * server service (src/lib/site-builder.ts), the guest showcase and the
 * check script. No database, no LLM imports.
 */

export const SITE_BUILDER_NOT_CONFIGURED_MESSAGE =
  "Website generation isn't configured yet. Add a provider API key and the builder will start creating sites.";

export type SiteTemplate = {
  id: string;
  label: string;
  blurb: string;
  /** Title a new project gets when the user does not name it. */
  defaultTitle: string;
  /** The strong starting prompt the template pre-fills (Lovable "remix"
   * idea: start from a finished brief, not a blank page). */
  starterPrompt: string;
  /** Palette / layout / sections direction appended server-side to the
   * first generation, so quality stays high even from a one-line brief. */
  designDirection: string;
};

/**
 * Template gallery mirroring what Lovable (remixable category templates:
 * blog/editorial, portfolio, photography, SaaS/fintech, law firm, store,
 * events, agency, barbershop booking) and Replit's Build gallery (builder
 * types: wedding, landing page, real estate, ecommerce, booking, church,
 * portfolio, blog, restaurant, fitness, hotel) prove users look for.
 * v1 scope stays single-page: every template is one rich page of sections.
 */
export const SITE_TEMPLATES: SiteTemplate[] = [
  {
    id: "restaurant",
    label: "Restaurant",
    blurb: "Menu, hours and WhatsApp ordering",
    defaultTitle: "My restaurant website",
    starterPrompt:
      "Build a one-page website for my restaurant: a warm hero with the restaurant name, a short about section, a menu with categories and prices that visitors can filter, opening hours, customer reviews, and a contact section with a WhatsApp order button and a tap-to-call button.",
    designDirection:
      "Warm, appetising palette (deep greens or rich burgundy with cream). Serif display headings. Sections in order: hero with a signature dish, about, filterable menu with prices, opening hours, reviews, contact with WhatsApp order button and tap-to-call.",
  },
  {
    id: "salon",
    label: "Salon & Beauty",
    blurb: "Price list and WhatsApp booking",
    defaultTitle: "My salon website",
    starterPrompt:
      "Build a one-page website for my salon: an elegant hero, a services list with prices, a small gallery, customer reviews, opening hours, and a WhatsApp booking button so customers can book in one tap.",
    designDirection:
      "Soft, elegant palette (blush, ivory, charcoal accents), refined serif + clean sans pairing. Sections: hero, services with price list, gallery, reviews, opening hours, WhatsApp booking button kept visible.",
  },
  {
    id: "shop",
    label: "Shop / Store",
    blurb: "Products, prices and WhatsApp enquiries",
    defaultTitle: "My shop website",
    starterPrompt:
      "Build a one-page website for my shop: a bold hero, a product grid with categories visitors can filter and prices, why customers trust us, reviews, and a contact section with a WhatsApp enquiry button on every product.",
    designDirection:
      "Clean retail layout, bright palette with one strong accent colour. Sections: hero with a featured offer, filterable product grid with prices, trust points (delivery, returns, genuine products), reviews, contact with WhatsApp enquiry buttons.",
  },
  {
    id: "hotel",
    label: "Hotel",
    blurb: "Rooms, amenities and booking enquiries",
    defaultTitle: "My hotel website",
    starterPrompt:
      "Build a one-page website for my hotel: a scenic hero, rooms with prices, amenities, a gallery, guest reviews, location and contact details, and a WhatsApp booking enquiry button.",
    designDirection:
      "Calm, premium palette (sand, deep teal or navy, white space). Sections: full-width hero, rooms with nightly prices, amenities grid, gallery, guest reviews, location, WhatsApp booking enquiry.",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    blurb: "Your work, story and contact",
    defaultTitle: "My portfolio website",
    starterPrompt:
      "Build a one-page portfolio website for me: a strong hero with my name and what I do, a gallery of my best work, my services, client testimonials, and a contact section with a WhatsApp button.",
    designDirection:
      "Minimal, work-first layout — the projects are the design. Neutral palette with one accent. Sections: hero with name and craft, filterable work gallery, services, testimonials, about, contact with WhatsApp button.",
  },
  {
    id: "real-estate",
    label: "Real Estate",
    blurb: "Listings and agent enquiries",
    defaultTitle: "My real estate website",
    starterPrompt:
      "Build a one-page website for my real estate agency: a confident hero, featured property listings with photos, prices, beds and baths that visitors can filter by type, why buyers trust us, client stories, and a WhatsApp enquiry button on every listing.",
    designDirection:
      "Trustworthy palette (deep navy or forest green with white and gold accents). Sections: hero with a search-feel banner, filterable featured listings with price/beds/baths, sold highlights, about the agent, testimonials, WhatsApp enquiry per listing.",
  },
  {
    id: "clinic",
    label: "Clinic / Doctor",
    blurb: "Services, timings and appointments",
    defaultTitle: "My clinic website",
    starterPrompt:
      "Build a one-page website for my clinic: a calm, trustworthy hero, the treatments and services we offer, doctor timings, patient reviews, health tips, and a WhatsApp appointment button with a tap-to-call number.",
    designDirection:
      "Clean medical palette (soft teal or blue with white, lots of breathing room). Sections: hero with trust signals, services/treatments, doctor profile and timings, patient reviews, FAQ, appointment via WhatsApp and tap-to-call.",
  },
  {
    id: "gym",
    label: "Gym / Fitness",
    blurb: "Plans, schedule and free trial",
    defaultTitle: "My gym website",
    starterPrompt:
      "Build a one-page website for my gym: a high-energy hero, membership plans with prices, the weekly class schedule, trainer profiles, member results, and a WhatsApp button to claim a free trial.",
    designDirection:
      "Bold, high-contrast palette (near-black with one electric accent). Big condensed headings. Sections: hero with a strong claim, plans with prices, class schedule table, trainers, transformations/results, free-trial WhatsApp CTA.",
  },
  {
    id: "agency",
    label: "Agency / Services",
    blurb: "Services, results and enquiries",
    defaultTitle: "My agency website",
    starterPrompt:
      "Build a one-page website for my agency: a sharp hero with our promise, the services we offer, results and case highlights with numbers, client logos and testimonials, our process, and a contact section with a WhatsApp enquiry button.",
    designDirection:
      "Modern agency look — dark or stark-white layout, one vivid accent, oversized type. Sections: hero with a measurable promise, services grid, results with numbers, testimonials, 3-step process, contact with WhatsApp enquiry.",
  },
  {
    id: "saas",
    label: "SaaS Landing Page",
    blurb: "Features, pricing and sign-up",
    defaultTitle: "My SaaS landing page",
    starterPrompt:
      "Build a one-page landing page for my software product: a clear hero with the product promise and a sign-up button, logos of happy customers, the key features with benefits, how it works in three steps, pricing tiers with a highlighted middle plan, FAQ, and a final sign-up call to action.",
    designDirection:
      "Clean SaaS layout (white or deep slate with one product accent colour), crisp sans type. Sections: hero with product visual mock, social proof strip, features grid, how it works, pricing tiers with the middle one highlighted, FAQ accordion, final CTA.",
  },
  {
    id: "wedding",
    label: "Wedding / Event",
    blurb: "Story, schedule and RSVP",
    defaultTitle: "My wedding website",
    starterPrompt:
      "Build a one-page wedding website for us: an elegant hero with our names and the date, our story, the day's schedule, venue details with directions, a photo gallery, and an RSVP section that sends guests to WhatsApp.",
    designDirection:
      "Romantic editorial palette (ivory, sage or dusty rose, gold details), graceful serif headings. Sections: hero with names/date and a countdown feel, our story, schedule timeline, venue and directions, gallery, RSVP via WhatsApp.",
  },
  {
    id: "blog",
    label: "Blog / Magazine",
    blurb: "Stories, categories and newsletter",
    defaultTitle: "My blog website",
    starterPrompt:
      "Build a one-page blog and magazine website: a striking masthead, one featured story, a grid of latest articles visitors can filter by category, an about-the-author section, and a newsletter sign-up section.",
    designDirection:
      "Editorial magazine layout — warm serif headlines, generous white space, category filter chips. Sections: masthead, featured story, filterable article grid with reading times, about the author, newsletter sign-up block.",
  },
  {
    id: "photography",
    label: "Photography",
    blurb: "Galleries, packages and booking",
    defaultTitle: "My photography website",
    starterPrompt:
      "Build a one-page website for my photography business: a cinematic full-screen hero photo, galleries visitors can filter by shoot type (weddings, portraits, events), my packages with prices, kind words from clients, and a WhatsApp booking button.",
    designDirection:
      "Dark, cinematic, gallery-first — photos carry the page, text stays minimal. Sections: full-bleed hero, filterable gallery, packages with prices, about the photographer, testimonials, WhatsApp booking.",
  },
  {
    id: "law",
    label: "Law Firm",
    blurb: "Practice areas and consultation",
    defaultTitle: "My law firm website",
    starterPrompt:
      "Build a one-page website for my law firm: a dignified hero, our practice areas, attorney profiles, results and client testimonials, and a confidential consultation section with a WhatsApp button and tap-to-call.",
    designDirection:
      "Dignified palette (deep navy or charcoal with gold accents), classic serif headings. Sections: hero with credentials, practice areas grid, attorney profiles, results/testimonials, consultation CTA with WhatsApp and tap-to-call.",
  },
  {
    id: "cafe",
    label: "Café / Food Truck",
    blurb: "Menu, location and hours",
    defaultTitle: "My café website",
    starterPrompt:
      "Build a one-page website for my café: a cosy hero, the menu with prices, today's specials, a photo gallery, where to find us with opening hours, and a WhatsApp button for orders and bookings.",
    designDirection:
      "Cosy, casual palette (warm browns, cream, one fresh accent), friendly rounded type. Sections: hero, specials strip, menu with prices, gallery, location and hours, WhatsApp order button.",
  },
  {
    id: "blank",
    label: "Blank",
    blurb: "Describe anything you want",
    defaultTitle: "Untitled website",
    starterPrompt: "",
    designDirection: "",
  },
];

export function siteTemplateById(id?: string | null): SiteTemplate {
  return (
    SITE_TEMPLATES.find((row) => row.id === id) ??
    SITE_TEMPLATES[SITE_TEMPLATES.length - 1]
  );
}

export function isSiteTemplateId(id?: string | null): boolean {
  return SITE_TEMPLATES.some((row) => row.id === id);
}

/** Per-plan website project caps (design note §6). Prices never change. */
export const SITE_PROJECT_CAPS: Record<PlanId, number> = {
  demo: 1,
  starter: 3,
  pro: 10,
  ultra: 25,
};

export function siteProjectCapForPlan(plan?: string | null): number {
  return SITE_PROJECT_CAPS[normalizeSitePlanId(plan)];
}

/**
 * Publishing (Package 11d) — subdomain slugs. A published site lives at
 * https://<slug>.cinem.tech, served from inside this app (no per-site
 * deploy). Slugs come from the project title; reserved names can never
 * be claimed because they belong to CINEM itself or to infrastructure.
 */
export const SITE_SLUG_MAX_LENGTH = 40;

export const RESERVED_SITE_SLUGS = new Set([
  "app", "www", "console", "api", "admin", "mail", "email", "ftp",
  "staging", "stage", "dev", "test", "demo", "blog", "news", "help",
  "support", "status", "cdn", "assets", "static", "files", "media",
  "images", "img", "login", "signup", "register", "account", "accounts",
  "billing", "pay", "payments", "shop", "store", "cinem", "cinempro",
  "malik", "malikdatacentre", "dashboard", "desk", "chat", "build",
  "builder", "sites", "site", "home", "about", "contact", "privacy",
  "terms", "legal", "security", "docs", "download", "downloads",
  "invite", "auth", "oauth", "callback", "webhook", "webhooks",
  "internal", "system", "root", "null", "undefined", "true", "false",
]);

export function isReservedSiteSlug(slug: string): boolean {
  return RESERVED_SITE_SLUGS.has(slug);
}

/** Turn a project title into a valid subdomain slug ("" when nothing usable). */
export function slugifySiteTitle(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    // (combining diacritics stripped so "Café" → "cafe")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, SITE_SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
  // A subdomain label cannot be all digits or a single character.
  if (slug.length < 2 || /^\d+$/.test(slug)) return "";
  return slug;
}

export function isValidSiteSlug(slug: string): boolean {
  return (
    slug.length >= 2 &&
    slug.length <= SITE_SLUG_MAX_LENGTH &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
    !isReservedSiteSlug(slug)
  );
}

/** First free slug for a base: base, base-2, base-3, … */
export function pickSiteSlug(base: string, taken: ReadonlySet<string>): string {
  const root = base || "my-website";
  if (!taken.has(root) && !isReservedSiteSlug(root)) return root;
  for (let n = 2; n < 1000; n += 1) {
    const suffix = `-${n}`;
    const candidate =
      root.slice(0, SITE_SLUG_MAX_LENGTH - suffix.length).replace(/-+$/g, "") +
      suffix;
    if (!taken.has(candidate) && !isReservedSiteSlug(candidate)) return candidate;
  }
  return `${root.slice(0, SITE_SLUG_MAX_LENGTH - 5)}-${Date.now() % 10000}`;
}

export function publishedSiteUrl(slug: string): string {
  return `https://${slug}.cinem.tech`;
}

export function publishedSitePath(slug: string): string {
  return `/sites/${slug}`;
}

/** Extract the site slug from a Host header, or null when the host is not
 * a builder-site subdomain (the app's own hosts, reserved names, apex). */
export function siteSlugFromHost(host: string | null | undefined): string | null {
  const hostname = String(host || "")
    .split(":")[0]
    .trim()
    .toLowerCase();
  const match = hostname.match(/^([a-z0-9-]+)\.cinem\.tech$/);
  if (!match) return null;
  const slug = match[1];
  if (!isValidSiteSlug(slug)) return null;
  return slug;
}

/* ------------------------------------------------------------------ */
/* Multi-page sites (Package 11c)                                      */
/*                                                                     */
/* A multi-page build comes back from the model as one document per    */
/* page, separated by markers:                                         */
/*   <<<PAGE path="/" title="Home">>>                                  */
/*   ...full HTML...                                                   */
/*   <<<PAGE path="/about" title="About us">>>                         */
/* The home page stays in SiteVersion.html; the rest become SitePage   */
/* rows. No markers = a v1 single-page site, handled exactly as        */
/* before.                                                             */
/* ------------------------------------------------------------------ */

export type SitePageDraft = { path: string; title: string; html: string };

export const SITE_MAX_PAGES = 12;
/** Total size cap for a whole multi-page site (home + all pages). */
export const SITE_MULTIPAGE_MAX_CHARS = 900_000;

const PAGE_MARKER = /<<<PAGE\s+path="([^"]*)"(?:\s+title="([^"]*)")?\s*>>>/gi;

/**
 * Normalize a raw page path to its stored form: no leading/trailing
 * slash, lowercase ("About/" → "about"). "" means the home page.
 * Returns null for anything that is not a safe in-site path.
 */
export function normalizeSitePagePath(raw: string): string | null {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");
  if (cleaned === "") return "";
  if (cleaned.length > 80) return null;
  if (!/^[a-z0-9][a-z0-9-_]*(\/[a-z0-9][a-z0-9-_]*)*$/.test(cleaned)) return null;
  return cleaned;
}

export function extractSitePageTitle(html: string, fallback: string): string {
  const match = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i);
  const title = match?.[1]?.trim().replace(/\s+/g, " ");
  return title || fallback;
}

function looksLikePageHtml(html: string): boolean {
  return /<!doctype html|<html[\s>]|<body[\s>]|<main[\s>]|<div[\s>]/i.test(html);
}

export type ParsedMultiPage = { home: string; pages: SitePageDraft[] };

/**
 * Split a model result into home + sub-pages. Returns null when the
 * output is not a valid multi-page document (the caller then treats it
 * as a single-page result, exactly like v1).
 */
export function parseMultiPageOutput(content: string): ParsedMultiPage | null {
  const markers = [...content.matchAll(PAGE_MARKER)];
  if (markers.length === 0) return null;
  let home: string | null = null;
  const pages: SitePageDraft[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < markers.length; i += 1) {
    const marker = markers[i];
    const start = (marker.index ?? 0) + marker[0].length;
    const end = i + 1 < markers.length ? markers[i + 1].index ?? content.length : content.length;
    const html = content.slice(start, end).trim();
    if (!looksLikePageHtml(html)) continue;
    const path = normalizeSitePagePath(marker[1] ?? "");
    if (path === null) continue;
    if (path === "") {
      if (home === null) home = html;
      continue;
    }
    if (seen.has(path) || pages.length >= SITE_MAX_PAGES) continue;
    seen.add(path);
    pages.push({
      path,
      title:
        (marker[2] ?? "").trim() ||
        extractSitePageTitle(html, path.replace(/[-/]/g, " ")),
      html,
    });
  }
  if (home === null) {
    // No explicit home marker: a full HTML preamble before the first
    // marker can serve as the home page.
    const preamble = content.slice(0, markers[0].index ?? 0).trim();
    if (looksLikePageHtml(preamble)) home = preamble;
  }
  if (home === null || pages.length === 0) return null;
  return { home, pages };
}

/** Join home + pages back into the marker format (for edit prompts). */
export function buildMultiPageDocument(home: string, pages: SitePageDraft[]): string {
  const parts = [`<<<PAGE path="/" title="Home">>>\n${home}`];
  for (const page of pages) {
    parts.push(`<<<PAGE path="/${page.path}" title="${page.title.replace(/"/g, "")}">>>\n${page.html}`);
  }
  return parts.join("\n\n");
}

/**
 * Rewrite in-site links so they stay inside the surface serving the
 * site (published /sites/<slug> base, or any other base the caller
 * chooses). External links, anchors, tel:/mailto: and unknown paths are
 * left exactly as they are. `knownPaths` uses stored form ("", "about").
 */
export function rewriteSiteLinks(
  html: string,
  makeUrl: (path: string) => string,
  knownPaths: ReadonlySet<string>,
): string {
  return html.replace(
    /(\bhref\s*=\s*)("([^"]*)"|'([^']*)')/gi,
    (whole, prefix: string, _quoted: string, dq?: string, sq?: string) => {
      const value = dq ?? sq ?? "";
      const quote = dq !== undefined ? '"' : "'";
      if (
        !value ||
        value.startsWith("#") ||
        /^(https?:)?\/\//i.test(value) ||
        /^(mailto|tel|data|javascript):/i.test(value)
      ) {
        return whole;
      }
      const pathPart = value.split("#")[0].split("?")[0];
      const normalized = normalizeSitePagePath(pathPart);
      if (normalized === null || !knownPaths.has(normalized)) return whole;
      return `${prefix}${quote}${makeUrl(normalized)}${quote}`;
    },
  );
}

/**
 * The click interceptor injected into preview pages: a click on a link
 * to a known in-site page is reported to the preview shell instead of
 * navigating (a srcdoc iframe has nowhere real to navigate to).
 * `knownPaths` uses root form ("/", "/about").
 */
export function previewNavScript(knownPaths: string[]): string {
  const list = JSON.stringify(knownPaths);
  return `<script>(function(){var K=${list};document.addEventListener("click",function(e){var t=e.target;var a=t&&t.closest?t.closest("a[href]"):null;if(!a)return;var h=a.getAttribute("href")||"";if(!h||h.charAt(0)==="#")return;if(/^(https?:)?\\/\\//i.test(h)||/^(mailto|tel|data):/i.test(h))return;var p=h.split("#")[0].split("?")[0];if(p.charAt(0)!=="/")p="/"+p;p=p.replace(/\\/+$/,"")||"/";if(K.indexOf(p)===-1)return;e.preventDefault();if(window.parent&&window.parent!==window)window.parent.postMessage({cinemPage:p},"*");});})();</script>`;
}

export function injectPreviewNav(html: string, knownPaths: string[]): string {
  const script = previewNavScript(knownPaths);
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${script}</body>`);
  return `${html}${script}`;
}

/**
 * The preview shell document for a multi-page site: an inner sandboxed
 * iframe plus the page map. Page clicks inside arrive as postMessages
 * ({cinemPage}) from the page's injected interceptor; the builder UI can
 * jump pages with {cinemGoto}. `pages` uses root-form paths and must
 * include the home page at "/".
 */
export function buildPreviewShellHtml(input: {
  entryPath: string;
  pages: Array<{ path: string; html: string }>;
}): string {
  const map: Record<string, string> = {};
  for (const page of input.pages) map[page.path] = page.html;
  const json = JSON.stringify(map).replace(/<\//g, "<\\/");
  const entry = JSON.stringify(
    Object.prototype.hasOwnProperty.call(map, input.entryPath)
      ? input.entryPath
      : "/",
  );
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;height:100%;background:#fff}iframe{border:0;width:100%;height:100%;display:block}</style>
</head><body>
<iframe id="pg" sandbox="allow-scripts" title="Website preview"></iframe>
<script>
var PAGES = ${json};
var frame = document.getElementById("pg");
function render(p){ if(!Object.prototype.hasOwnProperty.call(PAGES, p)) p = "/"; frame.srcdoc = PAGES[p]; }
window.addEventListener("message", function(e){ var d = e.data || {}; var p = d.cinemPage || d.cinemGoto; if (typeof p === "string") render(p); });
render(${entry});
</script>
</body></html>`;
}

/** Hard ceiling for one build/edit, in returned tokens (design note §6). */
export const SITE_GENERATION_TOKEN_CEILING = 120_000;

/** Max stored page size — a one-page site is small; anything bigger is a runaway. */
export const SITE_HTML_MAX_CHARS = 400_000;
