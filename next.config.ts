import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma", "playwright-core"],
  // README and local tooling use 127.0.0.1; Next 16 treats that as a distinct
  // origin from localhost and otherwise blocks /_next client assets in dev.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
