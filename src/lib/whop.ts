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

export function whopAccountId() {
  return process.env.WHOP_COMPANY_ID?.trim() || process.env.WHOP_ACCOUNT_ID?.trim() || "";
}

export async function createWhopCheckout(input: {
  workspaceId: string;
  plan: CheckoutPlanId;
  origin: string;
}) {
  const client = getWhopClient();
  if (!client) {
    throw new ClientError(
      "Whop is not configured. Set WHOP_API_KEY, or keep BILLING_MOCK=true.",
      400,
    );
  }

  const redirectUrl = `${input.origin}/desk/${input.workspaceId}/billing?status=success&plan=${input.plan}`;
  const metadata = {
    workspaceId: input.workspaceId,
    plan: input.plan,
  };
  const accountId = whopAccountId() || undefined;
  const planId = whopPlanIdFor(input.plan);
  const productId = whopProductIdFor(input.plan);

  try {
    const checkout = planId
      ? await client.checkoutConfigurations.create({
          account_id: accountId,
          plan_id: planId,
          mode: "payment",
          metadata,
          redirect_url: redirectUrl,
        })
      : await client.checkoutConfigurations.create({
          account_id: accountId,
          mode: "payment",
          metadata,
          redirect_url: redirectUrl,
          plan: {
            account_id: accountId,
            currency: "usd",
            plan_type: "renewal",
            billing_period: 30,
            renewal_price: PLANS[input.plan].price,
            initial_price: 0,
            title: `CINEM Pro ${PLANS[input.plan].name}`,
            ...(productId ? { product_id: productId } : {}),
          },
        });

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

export async function createWhopSupportCheckout(input: {
  amountUsd: number;
  origin: string;
  workspaceId?: string | null;
  userId?: string | null;
  email?: string | null;
}) {
  const client = getWhopClient();
  if (!client) {
    throw new ClientError(
      "Whop is not configured. Set WHOP_API_KEY, or keep BILLING_MOCK=true.",
      400,
    );
  }

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

  const accountId = whopAccountId() || undefined;
  const productId = whopSupportProductId();

  try {
    const checkout = await client.checkoutConfigurations.create({
      account_id: accountId,
      mode: "payment",
      metadata,
      redirect_url: redirectUrl,
      plan: {
        account_id: accountId,
        currency: "usd",
        plan_type: "one_time",
        initial_price: input.amountUsd,
        renewal_price: 0,
        title: `Support ${COMPANY_NAME}`,
        description: `One-time support for ${PRODUCT_NAME}`,
        visibility: "hidden",
        force_create_new_plan: true,
        ...(productId ? { product_id: productId } : {}),
      },
    });

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
