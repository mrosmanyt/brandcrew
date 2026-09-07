import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  // The dev server binds 0.0.0.0 but is reached at 127.0.0.1:43180 (see README).
  // Next blocks cross-origin dev requests (including the HMR WebSocket) by
  // default, so allow the loopback origins the desk is actually opened from.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
