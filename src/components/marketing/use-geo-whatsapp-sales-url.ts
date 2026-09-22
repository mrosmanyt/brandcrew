"use client";

import { useEffect, useState } from "react";
import { assistantProSalesWhatsAppUrl } from "@/lib/geo-whatsapp";

/** Client-side geo lookup via `/api/geo/whatsapp` (Edge/Node API route). */
export function useGeoWhatsAppSalesUrl() {
  const [url, setUrl] = useState(() => assistantProSalesWhatsAppUrl(null));

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/geo/whatsapp", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { url?: string }) => {
        if (!cancelled && typeof data.url === "string" && data.url.startsWith("https://wa.me/")) {
          setUrl(data.url);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return url;
}
