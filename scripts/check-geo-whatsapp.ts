/**
 * Geo-routed WhatsApp sales links (India / Pakistan / default).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ASSISTANT_PRO_WHATSAPP_PREFILL,
  salesWhatsAppUrl,
  salesWhatsAppUrlFromRequest,
  WHATSAPP_SALES_DEFAULT_URL,
  WHATSAPP_SALES_INDIA_URL,
  WHATSAPP_SALES_PAKISTAN_URL,
  whatsAppSalesRegion,
} from "../src/lib/geo-whatsapp";

assert.equal(salesWhatsAppUrl("IN"), WHATSAPP_SALES_INDIA_URL);
assert.equal(salesWhatsAppUrl("PK"), WHATSAPP_SALES_PAKISTAN_URL);
assert.equal(salesWhatsAppUrl(null), WHATSAPP_SALES_DEFAULT_URL);
assert.equal(salesWhatsAppUrl("US"), WHATSAPP_SALES_PAKISTAN_URL);
assert.equal(whatsAppSalesRegion("IN"), "india");
assert.equal(whatsAppSalesRegion("DE"), "international");

const withPrefill = salesWhatsAppUrl("IN", ASSISTANT_PRO_WHATSAPP_PREFILL);
assert.match(withPrefill, /^https:\/\/wa\.me\/917202860041\?text=/);

const fromRequest = salesWhatsAppUrlFromRequest(
  new Request("https://app.cinem.tech/api/geo/whatsapp", {
    headers: { "x-vercel-ip-country": "IN" },
  }),
  ASSISTANT_PRO_WHATSAPP_PREFILL,
);
assert.equal(
  fromRequest,
  `${WHATSAPP_SALES_INDIA_URL}?text=${encodeURIComponent(ASSISTANT_PRO_WHATSAPP_PREFILL)}`,
);

const router = readFileSync("src/server/api/router.ts", "utf8");
assert.match(router, /api", "geo", "whatsapp/);

console.log("ok: geo WhatsApp routes India, Pakistan, and international default");
