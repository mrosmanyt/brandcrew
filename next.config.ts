import type { NextConfig } from "next";

const desktop = process.env.DESKTOP === "1";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma", "playwright-core"],
  // README and local tooling use 127.0.0.1; Next 16 treats that as a distinct
  // origin from localhost and otherwise blocks /_next client assets in dev.
  allowedDevOrigins: ["127.0.0.1"],
  ...(desktop
    ? {
        output: "standalone" as const,
        outputFileTracingIncludes: {
          "/*": [
            "./node_modules/.prisma/client/**/*",
            "./node_modules/@prisma/client/**/*",
          ],
        },
        outputFileTracingExcludes: {
          "/*": ["./node_modules/playwright-core/**/*"],
        },
      }
    : {}),
};

export default nextConfig;
