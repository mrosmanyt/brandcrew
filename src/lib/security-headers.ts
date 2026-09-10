import { WHOP_PIXEL_ORIGIN } from "./whop-pixel";

/**
 * Security headers in one place.
 *
 * Applied from `next.config.ts` (all routes, including static marketing pages)
 * and `src/proxy.ts` (request-time copy on matched routes).
 *
 * Follow-ups (separate pass, same module): nonce-based CSP, COOP/COEP,
 * Trusted Types, report-uri. Do not add a third-party WAF here.
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

/** Ordered list for next.config `headers()`. */
export function securityHeaderList(): HeaderPair[] {
  return [
    { key: "Content-Security-Policy", value: cspValue() },
    { key: "Strict-Transport-Security", value: "max-age=31536000" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    { key: "X-DNS-Prefetch-Control", value: "on" },
  ];
}

export function applySecurityHeaders(headers: Headers) {
  for (const row of securityHeaderList()) {
    headers.set(row.key, row.value);
  }
}
