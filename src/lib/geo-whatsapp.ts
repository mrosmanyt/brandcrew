/**
 * Geo-routed WhatsApp sales contacts for Cinem AI Assistant Pro.
 * Single source of truth for wa.me links (India / Pakistan / default).
 */

export const WHATSAPP_SALES_INDIA_E164 = "917202860041";
export const WHATSAPP_SALES_PAKISTAN_E164 = "923489057646";

export const WHATSAPP_SALES_INDIA_URL = "https://wa.me/917202860041";
export const WHATSAPP_SALES_PAKISTAN_URL = "https://wa.me/923489057646";

/** Default when geo is unknown or detection fails (Pakistan / international). */
export const WHATSAPP_SALES_DEFAULT_URL = WHATSAPP_SALES_PAKISTAN_URL;

export type WhatsAppSalesRegion = "india" | "pakistan" | "international";

export function normalizeCountryCode(raw?: string | null): string | null {
  const code = String(raw || "")
    .trim()
    .toUpperCase();
  if (!code || code === "XX" || code === "T1") return null;
  return code.length === 2 ? code : null;
}

export function whatsAppSalesRegion(countryCode?: string | null): WhatsAppSalesRegion {
  const cc = normalizeCountryCode(countryCode);
  if (cc === "IN") return "india";
  if (cc === "PK") return "pakistan";
  return "international";
}

export function salesWhatsAppUrl(countryCode?: string | null, prefillText?: string): string {
  const region = whatsAppSalesRegion(countryCode);
  const base =
    region === "india" ? WHATSAPP_SALES_INDIA_URL : WHATSAPP_SALES_PAKISTAN_URL;
  const text = prefillText?.trim();
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function salesWhatsAppE164(countryCode?: string | null): string {
  return whatsAppSalesRegion(countryCode) === "india"
    ? WHATSAPP_SALES_INDIA_E164
    : WHATSAPP_SALES_PAKISTAN_E164;
}

/** Read country from inbound request headers (Vercel geo + common CDN fallbacks). */
export function readRequestCountryCode(request: Request): string | null {
  return readHeaderCountryCode(request.headers);
}

export function readHeaderCountryCode(headers: Headers): string | null {
  const candidates = [
    headers.get("x-vercel-ip-country"),
    headers.get("cf-ipcountry"),
    headers.get("x-country-code"),
  ];
  for (const raw of candidates) {
    const code = normalizeCountryCode(raw);
    if (code) return code;
  }
  return null;
}

export function salesWhatsAppUrlFromRequest(
  request: Request,
  prefillText?: string,
): string {
  return salesWhatsAppUrl(readRequestCountryCode(request), prefillText);
}

export const ASSISTANT_PRO_WHATSAPP_PREFILL =
  "Hi — I'd like Cinem AI Assistant Pro. My CINEM account email is:";

export function assistantProSalesWhatsAppUrl(countryCode?: string | null): string {
  return salesWhatsAppUrl(countryCode, ASSISTANT_PRO_WHATSAPP_PREFILL);
}

export function assistantProSalesWhatsAppUrlFromRequest(request: Request): string {
  return salesWhatsAppUrlFromRequest(request, ASSISTANT_PRO_WHATSAPP_PREFILL);
}
