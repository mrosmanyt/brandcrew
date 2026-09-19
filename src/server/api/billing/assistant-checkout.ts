import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  assistantBillingPath,
  assistantBillingPlan,
  assistantSubscriptionPeriodEnd,
  parseAssistantBillingPlanId,
  type AssistantBillingPlanId,
} from "@/lib/cinem-ai-assistant-billing";
import { billingIsMock, billingProvider, originFromRequest } from "@/lib/billing";
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

    const product = assistantBillingPlan(plan);
    const provider = billingProvider();
    const origin = originFromRequest(request);
    const successPath = `${assistantBillingPath(plan)}&status=success`;

    if (billingIsMock()) {
      await applyMockAssistantSubscription(user.id, plan);
      return jsonOk({
        mock: true,
        provider: "mock",
        plan,
        product: CINEM_AI_ASSISTANT_PRODUCT,
        redirect: successPath,
      });
    }

    if (provider === "whop") {
      const checkout = await createWhopAssistantCheckout({
        userId: user.id,
        email: user.email,
        plan,
        origin,
      });
      return jsonOk({ url: checkout.url, mock: false, provider: "whop", plan });
    }

    return jsonError(
      new Error(
        "Live assistant billing needs WHOP_API_KEY and WHOP_ASSISTANT_* plan IDs, or BILLING_MOCK=true.",
      ),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Choose monthly, 3 months, 6 months, or 1 year."));
    }
    return jsonError(error);
  }
}
