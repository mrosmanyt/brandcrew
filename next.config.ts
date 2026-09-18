import type { NextConfig } from "next";
import {
  CINEM_AI_ASSISTANT_SETUP_FILENAME,
  DESKTOP_AI_ASSISTANT_ADVANCED_DOWNLOAD,
  DESKTOP_WIN_DOWNLOAD,
  DESKTOP_WIN_PORTABLE,
  WIN_SETUP_FILENAME,
} from "./src/lib/desktop-download-redirects";
import { securityHeaderList } from "./src/lib/security-headers";

const desktop = process.env.DESKTOP === "1";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    proxyClientMaxBodySize: "16mb",
    authInterrupts: true,
  },
  serverExternalPackages: ["@prisma/client", "prisma", "playwright-core", "@composio/core"],
  // Static metadata PNGs live at /apple-icon.png etc. Alias the
  // extensionless Metadata API paths so crawlers and old bookmarks 200.
  async redirects() {
    return [
      { source: "/security", destination: "/privacy", permanent: true },
      // Never serve ~120MB installers from Vercel — hand off to GitHub Releases CDN.
      {
        source: `/downloads/${WIN_SETUP_FILENAME}`,
        destination: DESKTOP_WIN_DOWNLOAD,
        permanent: false,
      },
      {
        source: `/downloads/${CINEM_AI_ASSISTANT_SETUP_FILENAME}`,
        destination: DESKTOP_AI_ASSISTANT_ADVANCED_DOWNLOAD,
        permanent: false,
      },
      {
        source: "/downloads/CINEM-Pro-Portable.exe",
        destination: DESKTOP_WIN_PORTABLE,
        permanent: false,
      },
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
      {
        source: "/downloads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
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
  ...(desktop
    ? {
        output: "standalone" as const,
        outputFileTracingIncludes: {
          "/*": [
            "./node_modules/.prisma/client/**/*",
            "./node_modules/@prisma/client/**/*",
          ],
        },
      }
    : {}),
};

export default nextConfig;
