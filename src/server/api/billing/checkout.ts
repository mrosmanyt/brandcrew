import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { billingIsMock, getStripe, planBudget, priceIdForPlan } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

const schema = z.object({
  workspaceId: z.string().min(1),
  plan: z.enum(["starter", "growth"]),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const { workspace } = await requireWorkspaceMember(body.workspaceId);

    if (billingIsMock()) {
      const updated = await prisma.workspace.update({
        where: { id: workspace.id },
        data: {
          plan: body.plan,
          tokenBudget: planBudget(body.plan),
        },
      });
      return jsonOk({
        mock: true,
        plan: updated.plan,
        tokenBudget: updated.tokenBudget,
      });
    }

    const stripe = getStripe();
    const price = priceIdForPlan(body.plan);
    if (!stripe || !price) {
      return NextResponse.json(
        {
          error:
            "Stripe is not configured. Set STRIPE_SECRET_KEY and price IDs, or keep BILLING_MOCK=true.",
        },
        { status: 400 },
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/desk/${workspace.id}/billing?status=success&plan=${body.plan}`,
      cancel_url: `${origin}/desk/${workspace.id}/billing?status=cancelled`,
      metadata: {
        workspaceId: workspace.id,
        plan: body.plan,
      },
    });

    return jsonOk({ url: session.url, mock: false });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Choose Starter or Growth." }, { status: 400 });
    }
    return jsonError(error);
  }
}
