/**
 * Launch checklist + security baseline (no database).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { jsonError, ApiRateLimitError } from "../src/lib/http";
import { honeypotFilled, validateLoginInput, validateSignupInput } from "../src/lib/form-guard";
import {
  resetRateLimitStore,
  takeToken,
  sensitiveRateLimit,
  enforceSensitiveRateLimit,
} from "../src/lib/rate-limit";
import { assertStrongPassword } from "../src/lib/password-rules";
import { hibpRangeContainsSuffix, assertPasswordNotPwned } from "../src/lib/password";
import { googleEmailIsVerified } from "../src/lib/google-auth-shared";
import { SESSION_COOKIE } from "../src/lib/constants";
import { securityHeaderList } from "../src/lib/security-headers";
import { CINEM_MARK_PATHS, CINEM_MARK_POLYGONS } from "../src/lib/cinem-mark";
import { HONEYPOT_FIELD, SITE_ORIGIN, siteOrigin } from "../src/lib/site";
import sitemap from "../src/app/sitemap";
import robots from "../src/app/robots";

const logo = readFileSync("src/components/brand/logo.tsx", "utf8");
assert.match(logo, /CinemMark/);
assert.match(logo, /CINEM_MARK_PATHS/);
assert.match(logo, /CINEM_LOGO_SRC/);
assert.match(logo, /next\/image/);
assert.doesNotMatch(logo, />\s*CP\s*</);
assert.doesNotMatch(logo, /"CP"/);
console.log("ok: BrandMark uses the official PNG + geometric SVG, not a CP placeholder");

assert.equal(CINEM_MARK_PATHS.length, 2);
assert.equal(CINEM_MARK_POLYGONS.length, 2);
assert.ok(existsSync("public/brand/cinem-mark.svg"));
assert.ok(existsSync("public/brand/cinem-logo.png"));
assert.ok(existsSync("public/og.png"));
assert.ok(existsSync("public/apple-touch-icon.png"));
assert.ok(existsSync("public/icon-32.png"));
assert.ok(existsSync("src/app/icon.svg"));
assert.ok(existsSync("src/app/icon.png"));
assert.ok(existsSync("src/app/apple-icon.png"));
assert.ok(existsSync("src/app/opengraph-image.png"));
assert.ok(existsSync("src/app/twitter-image.png"));
assert.ok(existsSync("src/app/favicon.ico"));
const markSvg = readFileSync("public/brand/cinem-mark.svg", "utf8");
assert.match(markSvg, /M4 32/);
assert.match(markSvg, /M60 32/);
assert.match(markSvg, /prefers-color-scheme: dark/);
const login = readFileSync("src/app/login/login-screen.tsx", "utf8");
assert.match(login, /BrandMark/);
assert.match(login, /CinemLogoImage/);
const signup = readFileSync("src/app/signup/signup-screen.tsx", "utf8");
assert.match(signup, /BrandMark/);
assert.match(signup, /CinemLogoImage/);
const nav = readFileSync("src/components/marketing/site-nav.tsx", "utf8");
assert.match(nav, /BrandMark/);
console.log("ok: favicon SVG + PNG logo + OG + apple-icon files exist; login + nav render BrandMark");

const footer = readFileSync("src/components/marketing/home-sections.tsx", "utf8");
assert.match(footer, /href: "\/privacy"/);
assert.match(footer, /href: "\/terms"/);
assert.match(footer, /label: "Privacy"/);
assert.match(footer, /label: "Terms"/);
assert.match(footer, /From CINEM/);
assert.match(footer, /AI employee desk/);
assert.doesNotMatch(footer, /not a robot that posts/i);
assert.doesNotMatch(footer, /not a robot/i);
assert.match(footer, /BrandMark/);
const landing = readFileSync("src/app/page.tsx", "utf8");
assert.doesNotMatch(landing, /nothing posts/i);
assert.doesNotMatch(landing, /not a robot that posts/i);
assert.doesNotMatch(nav, /\/privacy/);
assert.match(nav, /Get started|Open desk/);
console.log("ok: Privacy/Terms in footer; tagline sells the agent desk; top nav unchanged");

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
assert.equal(sensitiveRateLimit(["api", "auth", "login"], "POST")?.key, "auth-login");
assert.equal(sensitiveRateLimit(["api", "auth", "signup"], "POST")?.key, "auth-signup");
assert.equal(sensitiveRateLimit(["api", "auth", "me"], "PATCH")?.key, "account");
assert.equal(sensitiveRateLimit(["api", "billing", "checkout"], "POST")?.key, "checkout");
assert.equal(sensitiveRateLimit(["api", "admin"], "GET")?.key, "admin");
assert.equal(sensitiveRateLimit(["api", "admin"], "POST")?.key, "admin-write");
assert.equal(sensitiveRateLimit(["api", "auth", "google", "callback"], "GET")?.key, "auth-google");
assert.equal(sensitiveRateLimit(["api", "v1", "jobs"], "GET"), null);
console.log("ok: in-memory rate limit trips after the window cap");

assert.equal(honeypotFilled({ [HONEYPOT_FIELD]: "http://spam.test" }), true);
assert.equal(honeypotFilled({ [HONEYPOT_FIELD]: "  " }), false);
assert.equal(honeypotFilled({ email: "a@b.com" }), false);
assert.equal(validateLoginInput("not-an-email", "x"), "Enter a valid email.");
assert.equal(validateLoginInput("a@b.com", ""), "Enter your password.");
assert.equal(validateLoginInput("a@b.com", "secret"), null);
assert.equal(validateSignupInput("", "a@b.com", "password1"), "Enter your name.");
assert.equal(validateSignupInput("Ada", "a@b.com", "short"), "Use at least 8 characters.");
assert.equal(
  validateSignupInput("Ada", "a@b.com", "password1"),
  "That password is too common. Choose another.",
);
assert.equal(validateSignupInput("Ada", "a@b.com", "correct-horse-9"), null);
assert.equal(assertStrongPassword("aaaaaaaa", "ada@example.com"), "Don't use a single repeated character.");
assert.equal(assertStrongPassword("adaxxxxx", "ada@example.com"), null);
assert.equal(
  assertStrongPassword("xxadaxxx", "adax@example.com"),
  "Don't include your email in the password.",
);
const sha1Password = createHash("sha1").update("password").digest("hex").toUpperCase();
assert.equal(hibpRangeContainsSuffix(sha1Password, `${sha1Password.slice(5)}:99\n`), true);
assert.equal(hibpRangeContainsSuffix(sha1Password, "DEADBEEF:1\n"), false);
console.log("ok: honeypot + auth form validation + password rules");

const errorLog = console.error;
console.error = () => undefined;
const leaked = jsonError(new Error("DATABASE_URL=postgres://secret"));
const leakedDev = jsonError(
  new Error("error: Environment variable not found: DATABASE_URL."),
);
console.error = errorLog;
assert.equal(leaked.status, 500);
const httpSrc = readFileSync("src/lib/http.ts", "utf8");
assert.match(httpSrc, /process\.env\.NODE_ENV === "production"/);
assert.match(httpSrc, /Something went wrong\. Try again\./);

async function main() {
    const body = (await leaked.json()) as { error?: string };
    assert.equal(body.error, "Something went wrong. Try again.");
    assert.doesNotMatch(String(body.error), /postgres|DATABASE_URL/i);
    const devBody = (await leakedDev.json()) as { error?: string };
    assert.equal(devBody.error, "Something went wrong. Try again.");
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
  assert.match(layout, /CINEM_OG_SRC|\/og\.png/);
  assert.match(layout, /CINEM_MARK_SRC|cinem-mark\.svg/);
  console.log("ok: root layout ships metadata, cookie banner, analytics hook, og/icon paths");

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

  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  assert.equal(await assertPasswordNotPwned("correct-horse-9"), null);
  globalThis.fetch = origFetch;
  console.log("ok: HIBP password check fails open when the range API is down");

  assert.equal(googleEmailIsVerified(true), true);
  assert.equal(googleEmailIsVerified(false), false);
  assert.equal(googleEmailIsVerified(undefined), false);
  const googleAuth = readFileSync("src/lib/google-auth.ts", "utf8");
  assert.match(googleAuth, /googleEmailIsVerified\(profile\.email_verified\)/);
  const googleCallback = readFileSync("src/server/api/auth/google-callback.ts", "utf8");
  assert.match(googleCallback, /email_unverified/);
  assert.match(googleCallback, /!profile\.emailVerified/);
  const signupScreen = readFileSync("src/app/signup/signup-screen.tsx", "utf8");
  assert.match(signupScreen, /Google already verifies/);
  console.log("ok: Google OpenID requires email_verified === true; password path is documented");

  const authSrc = readFileSync("src/lib/auth.ts", "utf8");
  assert.match(authSrc, /httpOnly: true/);
  assert.match(authSrc, /sameSite: "lax"/);
  assert.match(authSrc, /sessionCookieSecure/);
  assert.match(authSrc, /jar\.set\(SESSION_COOKIE/);
  assert.match(authSrc, SESSION_COOKIE === "brandcrew_session" ? /SESSION_COOKIE/ : /brandcrew_session/);

  function walkSource(dir: string, acc: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".next") continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walkSource(full, acc);
      else if (/\.(ts|tsx|js|mjs)$/.test(name)) acc.push(full);
    }
    return acc;
  }
  const sessionStoreHits: string[] = [];
  for (const file of walkSource("src")) {
    const text = readFileSync(file, "utf8");
    if (
      /localStorage\.setItem\([^)]*(session_token|brandcrew_session|SESSION_COOKIE)/.test(
        text,
      ) ||
      /sessionStorage\.setItem\([^)]*(session_token|brandcrew_session|SESSION_COOKIE)/.test(
        text,
      )
    ) {
      sessionStoreHits.push(file);
    }
  }
  assert.deepEqual(sessionStoreHits, []);
  console.log("ok: session JWT is HttpOnly cookie only; no localStorage session_token");

  const rateLimitSrc = readFileSync("src/lib/rate-limit.ts", "utf8");
  assert.match(rateLimitSrc, /auth-email/);
  assert.match(rateLimitSrc, /request\.clone\(\)/);
  assert.match(router, /await enforceSensitiveRateLimit/);
  assert.doesNotMatch(router, /auth\/forgot|password-reset|reset-password/);
  resetRateLimitStore();
  async function loginAttempt(ip: string, email: string) {
    return new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({ email, password: "x" }),
    });
  }
  for (let i = 0; i < 8; i += 1) {
    await enforceSensitiveRateLimit(
      await loginAttempt(`198.51.100.${i}`, "ada@example.com"),
      ["api", "auth", "login"],
      "POST",
    );
  }
  let emailLimited = false;
  try {
    await enforceSensitiveRateLimit(
      await loginAttempt("203.0.113.9", "ada@example.com"),
      ["api", "auth", "login"],
      "POST",
    );
  } catch (error) {
    emailLimited = error instanceof ApiRateLimitError;
  }
  assert.equal(emailLimited, true);
  console.log("ok: auth limits are per IP and per email; no password-reset route");

  const adminApi = readFileSync("src/server/api/admin/root.ts", "utf8");
  assert.ok(
    [...adminApi.matchAll(/await requireAdmin\(\)/g)].length >= 2,
    "GET and POST /api/admin must call requireAdmin",
  );
  function walkPages(dir: string, acc: string[] = []): string[] {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, name.name);
      if (name.isDirectory()) walkPages(full, acc);
      else if (name.name === "page.tsx") acc.push(full);
    }
    return acc;
  }
  const adminPages = walkPages("src/app/admin");
  assert.ok(adminPages.length >= 8, "expected Admin HQ pages");
  for (const page of adminPages) {
    assert.match(readFileSync(page, "utf8"), /loadAdminPage/, `${page} must call loadAdminPage`);
  }
  const adminLayout = readFileSync("src/app/admin/layout.tsx", "utf8");
  assert.match(adminLayout, /isAdminEmail/);
  assert.match(adminLayout, /getCurrentUser/);
  const settingsHub = readFileSync("src/components/desk/settings-hub.tsx", "utf8");
  assert.match(settingsHub, /user\.isAdmin \?/);
  assert.doesNotMatch(settingsHub, /\/api\/admin/);
  console.log("ok: /admin and /api/admin stay server-gated via ADMIN_EMAILS; UI only hides the link");

  console.log("Launch + security checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

