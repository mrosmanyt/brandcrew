import { NextResponse } from "next/server";
import {
  assistantProSalesWhatsAppUrlFromRequest,
  readRequestCountryCode,
  salesWhatsAppE164,
  whatsAppSalesRegion,
} from "@/lib/geo-whatsapp";
import { jsonOk } from "@/lib/http";
import { withNativeCors } from "@/lib/auth-native";

/**
 * Geo-routed WhatsApp sales URL for web + desktop assistant.
 * Uses Vercel `x-vercel-ip-country` when present; defaults to Pakistan/international.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const countryCode = readRequestCountryCode(request);
  const region = whatsAppSalesRegion(countryCode);
  const whatsappUrl = assistantProSalesWhatsAppUrlFromRequest(request);
  const payload = {
    url: whatsappUrl,
    countryCode,
    region,
    e164: salesWhatsAppE164(countryCode),
  };

  if (url.searchParams.get("redirect") === "1") {
    return withNativeCors(NextResponse.redirect(whatsappUrl, 302));
  }

  return withNativeCors(jsonOk(payload));
}
