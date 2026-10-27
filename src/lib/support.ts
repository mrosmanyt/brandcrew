import { COMPANY_NAME, PRODUCT_NAME } from "@/lib/constants";

export const SUPPORT_MIN_USD = 1;
export const SUPPORT_MAX_USD = 99_999;
export const SUPPORT_CHIPS_USD = [5, 20, 50, 100] as const;
export const SUPPORT_KIND = "support";

export function supportHeadline() {
  return `Support ${COMPANY_NAME}`;
}

export function supportProductLine() {
  return `Support ${PRODUCT_NAME}`;
}

export function parseSupportAmountUsd(raw: unknown): number | null {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw.trim().replace(/[$,]/g, ""))
        : NaN;
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  if (rounded < SUPPORT_MIN_USD || rounded > SUPPORT_MAX_USD) return null;
  return rounded;
}

export function supportAmountCents(usd: number) {
  return Math.round(usd * 100);
}

export function formatSupportUsd(usd: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: usd % 1 === 0 ? 0 : 2,
  }).format(usd);
}

export function formatSupportCents(cents: number) {
  return formatSupportUsd(cents / 100);
}

export function supportAmountError(raw: unknown): string | null {
  if (parseSupportAmountUsd(raw) !== null) return null;
  return `Enter an amount between ${formatSupportUsd(SUPPORT_MIN_USD)} and ${formatSupportUsd(SUPPORT_MAX_USD)}.`;
}

export function whopSupportPlanId() {
  return process.env.WHOP_SUPPORT_PLAN_ID?.trim() || "";
}

export function whopSupportProductId() {
  return process.env.WHOP_SUPPORT_PRODUCT_ID?.trim() || "";
}

export function isSupportPlanId(planId?: string | null) {
  const configured = whopSupportPlanId();
  return Boolean(configured && planId?.trim() && planId.trim() === configured);
}
