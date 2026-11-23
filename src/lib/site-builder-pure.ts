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

/** Hard ceiling for one build/edit, in returned tokens (design note §6). */
export const SITE_GENERATION_TOKEN_CEILING = 120_000;

/** Max stored page size — a one-page site is small; anything bigger is a runaway. */
export const SITE_HTML_MAX_CHARS = 400_000;
