import type { MetadataRoute } from "next";
import { PRODUCT_NAME } from "@/lib/constants";

/**
 * Web app manifest — makes CINEM Pro installable (home-screen icon,
 * standalone window) from the same deployment as the website.
 * Icons are rasterized from public/icon.svg, the icon source of truth.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    description:
      "CINEM Pro is CINEM's AI chat and image studio. Chat with leading AI models and generate images — all in one place.",
    start_url: "/chat",
    scope: "/",
    display: "standalone",
    background_color: "#1a1915",
    theme_color: "#1a1915",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
