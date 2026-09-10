import type { NextConfig } from "next";
import { securityHeaderList } from "./src/lib/security-headers";

const desktop = process.env.DESKTOP === "1";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "prisma", "playwright-core", "@composio/core"],
  // Static metadata PNGs live at /apple-icon.png etc. Alias the
  // extensionless Metadata API paths so crawlers and old bookmarks 200.
  async rewrites() {
    return [
      { source: "/apple-icon", destination: "/apple-icon.png" },
      { source: "/opengraph-image", destination: "/opengraph-image.png" },
      { source: "/twitter-image", destination: "/twitter-image.png" },
      { source: "/icon", destination: "/icon.png" },
    ];
  },
  async headers() {
    const security = securityHeaderList();
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
        source: "/og.png",
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
