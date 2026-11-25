import type { NextConfig } from "next";
import { securityHeaderList } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    proxyClientMaxBodySize: "16mb",
    authInterrupts: true,
  },
  serverExternalPackages: ["@prisma/client", "prisma", "playwright-core", "@composio/core", "mammoth", "exceljs"],
  // Static metadata PNGs live at /apple-icon.png etc. Alias the
  // extensionless Metadata API paths so crawlers and old bookmarks 200.
  async redirects() {
    return [
      { source: "/security", destination: "/privacy", permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: "/apple-icon", destination: "/apple-icon.png" },
      { source: "/opengraph-image", destination: "/opengraph-image.png" },
      { source: "/twitter-image", destination: "/twitter-image.png" },
      { source: "/icon", destination: "/icon.png" },
    ];
  },
  async headers() {
    // HSTS only on Vercel HTTPS. Local `next dev` / Electron stay HTTP.
    const deployedHttps = process.env.VERCEL === "1";
    const security = securityHeaderList().filter(
      (row) => deployedHttps || row.key !== "Strict-Transport-Security",
    );
    return [
      {
        source: "/:path*",
        headers: security,
      },
      {
        // The service worker script itself must never be cached, or
        // installed apps would keep running an old worker forever.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/brand/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/connectors/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/og.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/bots/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
    ];
  },
  // README and local tooling use 127.0.0.1; Next 16 treats that as a distinct
  // origin from localhost and otherwise blocks /_next client assets in dev.
  allowedDevOrigins: ["127.0.0.1"],
  // Vercel Hobby has no Chrome; PLAYWRIGHT_ENABLED defaults off there and
  // browse falls back to fetch. Keep playwright-core out of function traces
  // so one catch-all API function does not balloon toward the 50MB split.
  outputFileTracingExcludes: {
    "/*": ["./node_modules/playwright-core/**/*"],
  },
};

export default nextConfig;
