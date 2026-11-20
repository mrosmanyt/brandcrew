import { WHOP_PIXEL_ORIGIN } from "./whop-pixel";

/**
 * Security headers in one place.
 *
 * Applied from `next.config.ts` (all routes, including static marketing pages)
 * and `src/proxy.ts` (request-time copy on matched routes).
 * HSTS is skipped on local HTTP (`next dev` / Electron) so http://127.0.0.1
 * is not pinned to HTTPS. Vercel production sends it from next.config
 * (`VERCEL=1`) plus proxy when `x-forwarded-proto` is https. Keep HSTS
 * out of vercel.json so local HTTP (`vercel dev` / `next dev`) is not pinned.
 *
 * COOP is `same-origin-allow-popups`: OAuth is a top-level redirect, and
 * artifact print uses window.open to a same-origin document.
 *
 * CSP tightening status: the enforced policy still allows
 * `'unsafe-inline'` scripts — Next.js emits inline bootstrap scripts and
 * the GTM / Whop pixels inject their own, so dropping it blind would
 * break pages. The nonce-based strict policy below is therefore shipped
 * as `Content-Security-Policy-Report-Only` from `src/proxy.ts` (fresh
 * nonce per request; Next stamps its own scripts with it, so reports
 * isolate the remaining third-party/inline blockers). Flip it to
 * enforced once the report stream is clean. `script-src-attr 'none'` is
 * already enforced: no inline event-handler attributes exist in the app.
 * Remaining follow-ups: a report collection endpoint for the report-only
 * stream, COEP, Trusted Types. Do not add a third-party WAF here.
 *
 * HTTPS: Vercel redirects HTTP→HTTPS on *.vercel.app. HSTS + CSP
 * `upgrade-insecure-requests` reinforce that. Do not set HSTS preload
 * on a vercel.app subdomain we do not control.
 *
 * CSRF: session cookie is httpOnly + SameSite=Lax + Secure in production
 * (`src/lib/auth.ts`). Browser same-origin POSTs send it; cross-site
 * POSTs from other origins do not. OAuth callbacks are top-level GET.
 */

export type HeaderPair = { key: string; value: string };

export const HSTS_VALUE = "max-age=31536000; includeSubDomains";
export const COOP_VALUE = "same-origin-allow-popups";

function cspValue() {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    isDev ? "'unsafe-eval'" : "",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://plausible.io",
    WHOP_PIXEL_ORIGIN,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://plausible.io https://*.plausible.io ${WHOP_PIXEL_ORIGIN} https://*.whop.tw`,
    "frame-src 'self' blob: data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; ");
}

/** Request header that carries the per-request CSP nonce to pages. */
export const CSP_NONCE_HEADER = "x-nonce";

/** Fresh nonce for one request (base64 of a random UUID, per Next docs). */
export function generateCspNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

/**
 * The strict policy we intend to enforce eventually: nonce-based
 * `script-src` with `'strict-dynamic'` and no `'unsafe-inline'`, so a
 * script runs only if Next stamped it with this request's nonce or a
 * trusted script loaded it. Host sources are omitted from `script-src`
 * on purpose — browsers ignore them under `'strict-dynamic'`; the pixel
 * origins stay in `connect-src`, which still applies.
 *
 * Everything else mirrors the enforced policy so report-only violations
 * isolate the script changes. Two deliberate exceptions kept from the
 * enforced policy: `style-src 'unsafe-inline'` (React inline styles and
 * Next style tags are a separate migration) and the same permissive
 * `img-src`/`frame-src` (provider media and blob previews).
 */
export function strictCspReportOnlyValue(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    isDev ? "'unsafe-eval'" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://plausible.io https://*.plausible.io ${WHOP_PIXEL_ORIGIN} https://*.whop.tw`,
    "frame-src 'self' blob: data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; ");
}

/** Attach the strict policy as report-only (never blocks, only reports). */
export function applyReportOnlyCsp(headers: Headers, nonce: string) {
  headers.set(
    "Content-Security-Policy-Report-Only",
    strictCspReportOnlyValue(nonce),
  );
}

/** Ordered list for next.config `headers()`. */
export function securityHeaderList(): HeaderPair[] {
  return [
    { key: "Content-Security-Policy", value: cspValue() },
    { key: "Strict-Transport-Security", value: HSTS_VALUE },
    { key: "Cross-Origin-Opener-Policy", value: COOP_VALUE },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      // Microphone is `(self)`, not `()`: the chat voice input records via
      // getUserMedia on our own origin. `()` would forbid the browser from
      // ever showing the permission prompt, so voice could never work.
      // Everything else stays fully disabled.
      value:
        "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    { key: "X-DNS-Prefetch-Control", value: "on" },
  ];
}

export function requestLooksHttps(input: {
  protoHeader?: string | null;
  protocol?: string | null;
}): boolean {
  const proto = (input.protoHeader || input.protocol || "")
    .split(",")[0]
    ?.trim()
    .replace(/:$/, "")
    .toLowerCase();
  return proto === "https";
}

export function applySecurityHeaders(
  headers: Headers,
  opts?: { https?: boolean },
) {
  for (const row of securityHeaderList()) {
    if (row.key === "Strict-Transport-Security" && opts?.https === false) {
      continue;
    }
    headers.set(row.key, row.value);
  }
}
