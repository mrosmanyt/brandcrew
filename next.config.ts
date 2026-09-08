import type { NextConfig } from "next";
import { securityHeaderList } from "./src/lib/security-headers";

const desktop = process.env.DESKTOP === "1";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "prisma", "playwright-core"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaderList(),
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
