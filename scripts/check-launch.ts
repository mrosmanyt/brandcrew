/**
 * Launch checklist + security baseline (no database).
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { jsonError } from "../src/lib/http";
import { honeypotFilled, validateLoginInput, validateSignupInput } from "../src/lib/form-guard";
import {
  resetRateLimitStore,
  takeToken,
  sensitiveRateLimit,
} from "../src/lib/rate-limit";
import { securityHeaderList } from "../src/lib/security-headers";
import { CINEM_MARK_PATHS, CINEM_MARK_POLYGONS } from "../src/lib/cinem-mark";
import { HONEYPOT_FIELD, SITE_ORIGIN, siteOrigin } from "../src/lib/site";
import sitemap from "../src/app/sitemap";
import robots from "../src/app/robots";

const logo = readFileSync("src/components/brand/logo.tsx", "utf8");
assert.match(logo, /CinemMark/);
assert.match(logo, /CINEM_MARK_PATHS/);
assert.doesNotMatch(logo, />\s*CP\s*</);
assert.doesNotMatch(logo, /"CP"/);
console.log("ok: BrandMark uses the geometric mark, not a CP placeholder");

assert.equal(CINEM_MARK_PATHS.length, 2);
assert.equal(CINEM_MARK_POLYGONS.length, 2);
assert.ok(existsSync("public/brand/cinem-mark.svg"));
assert.ok(existsSync("src/app/icon.svg"));
assert.ok(existsSync("src/app/opengraph-image.tsx"));
assert.ok(existsSync("src/app/apple-icon.tsx"));
const markSvg = readFileSync("public/brand/cinem-mark.svg", "utf8");
assert.match(markSvg, /M4 32/);
assert.match(markSvg, /M60 32/);
console.log("ok: favicon SVG + OG + apple-icon files exist");

const footer = readFileSync("src/components/marketing/home-sections.tsx", "utf8");
assert.match(footer, /href: "\/privacy"/);
assert.match(footer, /href: "\/terms"/);
assert.match(footer, /label: "Privacy"/);
assert.match(footer, /label: "Terms"/);
const nav = readFileSync("src/components/marketing/site-nav.tsx", "utf8");
assert.doesNotMatch(nav, /\/privacy/);
assert.match(nav, /Get started|Open desk/);
console.log("ok: Privacy/Terms in existing footer; top nav unchanged");

assert.ok(existsSync("src/app/privacy/page.tsx"));
assert.ok(existsSync("src/app/terms/page.tsx"));
assert.ok(existsSync("src/app/not-found.tsx"));
console.log("ok: /privacy, /terms, and custom 404 pages exist");

const headers = securityHeaderList();
const keys = headers.map((row) => row.key);
for (const need of [
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
]) {
  assert.ok(keys.includes(need), `missing header ${need}`);
}
const csp = headers.find((row) => row.key === "Content-Security-Policy")?.value || "";
assert.match(csp, /default-src 'self'/);
assert.match(csp, /upgrade-insecure-requests/);
assert.match(csp, /frame-ancestors 'none'/);
const hsts = headers.find((row) => row.key === "Strict-Transport-Security")?.value || "";
assert.match(hsts, /max-age=/);
assert.doesNotMatch(hsts, /preload/);
console.log("ok: security headers include CSP, HSTS, frame, nosniff, referrer, permissions");

resetRateLimitStore();
assert.equal(takeToken("t", 2, 60_000).ok, true);
assert.equal(takeToken("t", 2, 60_000).ok, true);
const blocked = takeToken("t", 2, 60_000);
assert.equal(blocked.ok, false);
if (!blocked.ok) assert.ok(blocked.retryAfterSec >= 1);
assert.equal(sensitiveRateLimit(["api", "auth", "login"], "POST")?.key, "auth");
assert.equal(sensitiveRateLimit(["api", "billing", "checkout"], "POST")?.key, "checkout");
assert.equal(sensitiveRateLimit(["api", "admin"], "GET")?.key, "admin");
assert.equal(sensitiveRateLimit(["api", "v1", "jobs"], "GET"), null);
console.log("ok: in-memory rate limit trips after the window cap");

assert.equal(honeypotFilled({ [HONEYPOT_FIELD]: "http://spam.test" }), true);
assert.equal(honeypotFilled({ [HONEYPOT_FIELD]: "  " }), false);
assert.equal(honeypotFilled({ email: "a@b.com" }), false);
assert.equal(validateLoginInput("not-an-email", "x"), "Enter a valid email.");
assert.equal(validateLoginInput("a@b.com", ""), "Enter your password.");
assert.equal(validateLoginInput("a@b.com", "secret"), null);
assert.equal(validateSignupInput("", "a@b.com", "password1"), "Enter your name.");
assert.equal(validateSignupInput("Ada", "a@b.com", "short"), "Password must be at least 8 characters.");
assert.equal(validateSignupInput("Ada", "a@b.com", "password1"), null);
console.log("ok: honeypot + auth form validation");

const saved = process.env.NODE_ENV;
process.env.NODE_ENV = "production";
const errorLog = console.error;
console.error = () => undefined;
const leaked = jsonError(new Error("DATABASE_URL=postgres://secret"));
console.error = errorLog;
assert.equal(leaked.status, 500);

async function main() {
  const body = (await leaked.json()) as { error?: string };
  assert.equal(body.error, "Something went wrong. Try again.");
  assert.doesNotMatch(String(body.error), /postgres|DATABASE_URL/i);
  if (saved) process.env.NODE_ENV = saved;
  else delete process.env.NODE_ENV;
  console.log("ok: production API errors do not echo internal messages");

  assert.equal(SITE_ORIGIN, "https://brandcrew.vercel.app");
  assert.match(siteOrigin(), /^https?:\/\//);
  const map = sitemap();
  const urls = map.map((row) => row.url);
  assert.ok(urls.some((url) => url === siteOrigin() || url === SITE_ORIGIN));
  assert.ok(urls.some((url) => url.includes("/privacy")));
  assert.ok(urls.some((url) => url.includes("/terms")));
  const bots = robots();
  const disallow = Array.isArray(bots.rules)
    ? bots.rules.flatMap((row) => row.disallow ?? [])
    : bots.rules.disallow ?? [];
  assert.ok(disallow.includes("/desk"));
  assert.ok(disallow.includes("/admin"));
  assert.ok(disallow.includes("/api"));
  assert.match(String(bots.sitemap), /sitemap\.xml/);
  console.log("ok: sitemap + robots cover marketing pages and hide desk/admin/api");

  const secretHits: string[] = [];
  const clientFiles = [
    "src/components/marketing/site-nav.tsx",
    "src/components/marketing/home-ctas.tsx",
    "src/app/login/login-screen.tsx",
    "src/app/signup/signup-screen.tsx",
    "src/components/site/analytics.tsx",
    "src/components/site/cookie-banner.tsx",
  ];
  const secretPattern =
    /OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|SESSION_SECRET|STRIPE_SECRET_KEY|WHOP_API_KEY|WHOP_WEBHOOK_SECRET/;
  for (const file of clientFiles) {
    const text = readFileSync(file, "utf8");
    if (secretPattern.test(text)) secretHits.push(file);
  }
  assert.deepEqual(secretHits, []);
  const analytics = readFileSync("src/components/site/analytics.tsx", "utf8");
  assert.match(analytics, /NEXT_PUBLIC_GA_ID/);
  assert.match(analytics, /NEXT_PUBLIC_PLAUSIBLE_DOMAIN/);
  assert.match(analytics, /consentAccepted|COOKIE_CONSENT/);
  console.log("ok: no server secrets in marketing/auth client files; analytics gated on env + consent");

  const layout = readFileSync("src/app/layout.tsx", "utf8");
  assert.match(layout, /metadataBase/);
  assert.match(layout, /CookieBanner/);
  assert.match(layout, /Analytics/);
  assert.match(layout, /openGraph/);
  console.log("ok: root layout ships metadata, cookie banner, analytics hook");

  const proxy = readFileSync("src/proxy.ts", "utf8");
  assert.match(proxy, /applySecurityHeaders/);
  const nextConfig = readFileSync("next.config.ts", "utf8");
  assert.match(nextConfig, /securityHeaderList/);
  assert.match(nextConfig, /poweredByHeader: false/);
  const router = readFileSync("src/server/api/router.ts", "utf8");
  assert.match(router, /enforceSensitiveRateLimit/);
  console.log("ok: headers wired in next.config + proxy; API dispatch rate-limits sensitive routes");

  const hero = readFileSync("src/components/marketing/hero-demo.tsx", "utf8");
  assert.match(hero, /aria-label/);
  const live = readFileSync("src/components/desk/live-results.tsx", "utf8");
  assert.match(live, /alt="Live browser screenshot"/);
  console.log("ok: key marketing/demo surfaces keep accessible names");

  console.log("Launch + security checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

