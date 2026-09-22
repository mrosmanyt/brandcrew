"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackFunnelEvent } from "@/lib/funnel-client";

/** Mounted once in the marketing shell — records an anonymous site-visit beacon per page load. */
export function FunnelTrack() {
  const pathname = usePathname();
  useEffect(() => {
    trackFunnelEvent("site_visit", pathname);
  }, [pathname]);
  return null;
}
