import { WhopClient } from "@whop/sdk";
import { ClientError } from "@/lib/http";
import {
  whopApiKey,
  whopPlanIdFor,
  whopProductIdFor,
} from "@/lib/billing";
import { COMPANY_NAME, PLANS, PRODUCT_NAME, type CheckoutPlanId } from "@/lib/constants";
import { SUPPORT_KIND, whopSupportProductId } from "@/lib/support";

const SANDBOX_API = "https://sandbox-api.whop.com/api/v1";

export function getWhopClient() {
  const token = whopApiKey();
  if (!token) return null;
  return new WhopClient({
    token,
    ...(process.env.WHOP_SANDBOX === "true" ? { baseUrl: SANDBOX_API } : {}),
  });
}

/** Company id (`biz_…`). `WHOP_ACCOUNT_ID` is an alias for older env names. */
export function whopCompanyId() {
  return process.env.WHOP_COMPANY_ID?.trim() || process.env.WHOP_ACCOUNT_ID?.trim() || "";
}

/** @deprecated Use `whopCompanyId`. Same env: WHOP_COMPANY_ID then WHOP_ACCOUNT_ID. */
export function whopAccountId() {
  return whopCompanyId();
}

export function requireWhopCompanyId() {
  const companyId = whopCompanyId();
  if (!companyId) {
    throw new ClientError(
      "Live Whop checkout needs WHOP_COMPANY_ID (biz_…). WHOP_ACCOUNT_ID is accepted as an alias.",
      400,
    );
  }
  return companyId;
}

/**
 * Current Whop OpenAPI uses `company_id` (required on inline `plan` for payment
 * checkout). `@whop/sdk` 1.1.2 still types `account_id`. Send both so live
 * checkout and older SDK/API aliases resolve the same `biz_…` company.
 */
function withWhopCompany<T extends object>(companyId: string, rest: T) {
  return { ...rest, company_id: companyId, account_id: companyId };
}

function requireWhopClient() {
  const client = getWhopClient();
  if (!client) {
    throw new ClientError(
      "Whop is not configured. Set WHOP_API_KEY, or keep BILLING_MOCK=true.",
      400,
    );
  }
  return client;
}

async function purchaseUrlFromCheckout(
  create: () => Promise<{ purchase_url?: string | null; id: string }>,
) {
  try {
    const checkout = await create();
    if (!checkout.purchase_url) {
      throw new ClientError("Whop did not return a checkout URL.", 502);
    }
    return { url: checkout.purchase_url, id: checkout.id };
  } catch (error) {
    if (error instanceof ClientError) throw error;
    const message = error instanceof Error ? error.message : "Whop checkout failed.";
    throw new ClientError(message, 502);
  }
}

export async function createWhopCheckout(input: {
  workspaceId: string;
  plan: CheckoutPlanId;
  origin: string;
}) {
  const client = requireWhopClient();
  const companyId = requireWhopCompanyId();

  const redirectUrl = `${input.origin}/desk/${input.workspaceId}/billing?status=success&plan=${input.plan}`;
  const metadata = {
    workspaceId: input.workspaceId,
    plan: input.plan,
  };
  const planId = whopPlanIdFor(input.plan);
  const productId = whopProductIdFor(input.plan);

  return purchaseUrlFromCheckout(() =>
    planId
      ? client.checkoutConfigurations.create(
          withWhopCompany(companyId, {
            plan_id: planId,
            mode: "payment" as const,
            metadata,
            redirect_url: redirectUrl,
          }),
        )
      : client.checkoutConfigurations.create(
          withWhopCompany(companyId, {
            mode: "payment" as const,
            metadata,
            redirect_url: redirectUrl,
            plan: withWhopCompany(companyId, {
              currency: "usd" as const,
              plan_type: "renewal",
              billing_period: 30,
              renewal_price: PLANS[input.plan].price,
              initial_price: 0,
              title: `CINEM Pro ${PLANS[input.plan].name}`,
              ...(productId ? { product_id: productId } : {}),
            }),
          }),
        ),
  );
}

export async function createWhopSupportCheckout(input: {
  amountUsd: number;
  origin: string;
  workspaceId?: string | null;
  userId?: string | null;
  email?: string | null;
}) {
  const client = requireWhopClient();
  const companyId = requireWhopCompanyId();

  const redirectUrl = input.workspaceId
    ? `${input.origin}/desk/${input.workspaceId}/billing?status=success&support=1`
    : `${input.origin}/support?status=success`;
  const metadata: Record<string, string> = {
    kind: SUPPORT_KIND,
    plan: SUPPORT_KIND,
    amountUsd: String(input.amountUsd),
  };
  if (input.workspaceId) metadata.workspaceId = input.workspaceId;
  if (input.userId) metadata.userId = input.userId;
  if (input.email) metadata.email = input.email;

  const productId = whopSupportProductId();

  return purchaseUrlFromCheckout(() =>
    client.checkoutConfigurations.create(
      withWhopCompany(companyId, {
        mode: "payment" as const,
        metadata,
        redirect_url: redirectUrl,
        plan: withWhopCompany(companyId, {
          currency: "usd" as const,
          plan_type: "one_time",
          initial_price: input.amountUsd,
          renewal_price: 0,
          title: `Support ${COMPANY_NAME}`,
          description: `One-time support for ${PRODUCT_NAME}`,
          visibility: "hidden",
          force_create_new_plan: true,
          ...(productId ? { product_id: productId } : {}),
        }),
      }),
    ),
  );
}
