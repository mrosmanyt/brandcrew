import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  assistantBillingPath,
  assistantCheckoutMisconfiguredMessage,
  assistantSubscriptionPeriodEnd,
  parseAssistantBillingPlanId,
  type AssistantBillingPlanId,
} from "@/lib/cinem-ai-assistant-billing";
import {
  billingIsMock,
  billingProvider,
  originFromRequest,
  whopIsConfigured,
} from "@/lib/billing";
import { CINEM_AI_ASSISTANT_PRODUCT } from "@/lib/cinem-ai-assistant";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { createWhopAssistantCheckout } from "@/lib/whop";

const schema = z.object({
  plan: z.enum(["monthly", "3mo", "6mo", "1yr"]),
});

async function applyMockAssistantSubscription(userId: string, plan: AssistantBillingPlanId) {
  const periodEnd = assistantSubscriptionPeriodEnd(plan);
  return prisma.assistantSubscription.upsert({
    where: { userId },
    create: {
      userId,
      plan,
      status: "active",
      currentPeriodEnd: periodEnd,
    },
    update: {
      plan,
      status: "active",
      currentPeriodEnd: periodEnd,
      whopMembershipId: null,
    },
  });
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = schema.parse(await request.json());
    const plan = parseAssistantBillingPlanId(body.plan);
    if (!plan) {
      return jsonError(new Error("Choose a valid assistant plan."));
    }

    const provider = billingProvider();
    const origin = originFromRequest(request);
    const successPath = `${assistantBillingPath(plan)}&status=success`;

    if (billingIsMock()) {
      if (process.env.BILLING_MOCK !== "true") {
        return jsonError(
          new Error(
            "Live assistant billing is not configured. Set WHOP_API_KEY, WHOP_COMPANY_ID, WHOP_ASSISTANT_PRODUCT_ID, and WHOP_ASSISTANT_* plan IDs in Vercel, or set BILLING_MOCK=true for local demo.",
          ),
        );
      }
      await applyMockAssistantSubscription(user.id, plan);
      return jsonOk({
        mock: true,
        provider: "mock",
        plan,
        product: CINEM_AI_ASSISTANT_PRODUCT,
        redirect: successPath,
      });
    }

    if (provider !== "whop" || !whopIsConfigured()) {
      return jsonError(
        new Error(
          "Live assistant billing uses Whop. Set WHOP_API_KEY and WHOP_COMPANY_ID, or BILLING_MOCK=true for local demo.",
        ),
      );
    }

    const misconfigured = assistantCheckoutMisconfiguredMessage(plan);
    if (misconfigured) {
      return jsonError(new Error(misconfigured));
    }

    const checkout = await createWhopAssistantCheckout({
      userId: user.id,
      email: user.email,
      plan,
      origin,
    });
    return jsonOk({ url: checkout.url, mock: false, provider: "whop", plan });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Choose monthly, 3 months, 6 months, or 1 year."));
    }
    return jsonError(error);
  }
}
