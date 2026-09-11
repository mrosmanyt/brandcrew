import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  billingIsMock,
  billingProvider,
  getStripe,
  originFromRequest,
} from "@/lib/billing";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import {
  COMPANY_NAME,
  PRODUCT_NAME,
} from "@/lib/constants";
import {
  parseSupportAmountUsd,
  supportAmountCents,
  supportAmountError,
  SUPPORT_KIND,
} from "@/lib/support";
import { applyPaidSupport } from "@/lib/support-fulfill";
import { createWhopSupportCheckout } from "@/lib/whop";

const schema = z.object({
  amount: z.union([z.number(), z.string()]),
  workspaceId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const amountUsd = parseSupportAmountUsd(body.amount);
    if (amountUsd === null) {
      return NextResponse.json(
        { error: supportAmountError(body.amount) },
        { status: 400 },
      );
    }

    const user = await getCurrentUser();
    let workspaceId: string | null = null;
    if (body.workspaceId && user) {
      const member = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: body.workspaceId,
            userId: user.id,
          },
        },
        select: { workspaceId: true },
      });
      if (member) workspaceId = member.workspaceId;
    }

    const provider = billingProvider();
    const origin = originFromRequest(request);

    if (billingIsMock()) {
      const paid = await applyPaidSupport({
        amountCents: supportAmountCents(amountUsd),
        userId: user?.id,
        workspaceId,
        email: user?.email,
        paymentId: `mock_support_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        provider: "mock",
      });
      return jsonOk({
        mock: true,
        provider: "mock",
        kind: SUPPORT_KIND,
        amountUsd,
        supporter: Boolean(user),
        outcome: paid.outcome,
        workspaceId,
      });
    }

    if (provider === "whop") {
      const checkout = await createWhopSupportCheckout({
        amountUsd,
        origin,
        workspaceId,
        userId: user?.id,
        email: user?.email,
      });
      return jsonOk({
        url: checkout.url,
        mock: false,
        provider: "whop",
        kind: SUPPORT_KIND,
        amountUsd,
      });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        {
          error:
            "Live Support checkout needs WHOP_API_KEY (preferred) or STRIPE_SECRET_KEY, or keep BILLING_MOCK=true.",
        },
        { status: 400 },
      );
    }

    const successUrl = workspaceId
      ? `${origin}/desk/${workspaceId}/billing?status=success&support=1`
      : `${origin}/support?status=success`;
    const cancelUrl = workspaceId
      ? `${origin}/desk/${workspaceId}/billing?status=cancelled&support=1`
      : `${origin}/support?status=cancelled`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: supportAmountCents(amountUsd),
            product_data: {
              name: `Support ${COMPANY_NAME}`,
              description: `One-time support for ${PRODUCT_NAME}`,
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        kind: SUPPORT_KIND,
        plan: SUPPORT_KIND,
        amountUsd: String(amountUsd),
        ...(workspaceId ? { workspaceId } : {}),
        ...(user?.id ? { userId: user.id } : {}),
        ...(user?.email ? { email: user.email } : {}),
      },
    });

    return jsonOk({
      url: session.url,
      mock: false,
      provider: "stripe",
      kind: SUPPORT_KIND,
      amountUsd,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Enter an amount between $1 and $99,999." },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}
