import { headers } from "next/headers";
import {
  assistantProSalesWhatsAppUrl,
  readHeaderCountryCode,
  salesWhatsAppUrl,
} from "@/lib/geo-whatsapp";

/** Server Components / Route Handlers on Node (and Edge when headers are present). */
export async function salesWhatsAppUrlFromHeaders(prefillText?: string) {
  const h = await headers();
  return salesWhatsAppUrl(readHeaderCountryCode(h), prefillText);
}

export async function assistantProSalesWhatsAppUrlFromHeaders() {
  const h = await headers();
  return assistantProSalesWhatsAppUrl(readHeaderCountryCode(h));
}
