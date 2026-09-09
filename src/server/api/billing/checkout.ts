import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import {
  billingIsMock,
  billingProvider,
  getStripe,
  planBudget,
  priceIdForPlan,
} from "@/lib/billing";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { normalizePlanId } from "@/lib/limits";
import { createWhopCheckout } from "@/lib/whop";

const schema = z.object({
  workspaceId: z.string().min(1),
  plan: z.enum(["demo", "starter", "pro", "growth", "ultra"]),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const { workspace } = await requireWorkspaceMember(body.workspaceId);
    const plan = normalizePlanId(body.plan);
    const provider = billingProvider();
    if (plan === "demo") {
      if (provider !== "mock") {
        return NextResponse.json(
          {
            error:
              "Live subscriptions cannot switch to Free from the desk. Open Plans.",
          },
          { status: 400 },
        );
      }
      const updated = await prisma.workspace.update({
        where: { id: workspace.id },
        data: {
          plan: "demo",
          tokenBudget: planBudget("demo"),
        },
      });
      return jsonOk({
        mock: true,
        provider: "mock",
        plan: updated.plan,
        tokenBudget: updated.tokenBudget,
      });
    }
    if (plan !== "starter" && plan !== "pro" && plan !== "ultra") {
      return NextResponse.json({ error: "Choose Starter, Pro, or Ultra." }, { status: 400 });
    }

    if (billingIsMock()) {
      const updated = await prisma.workspace.update({
        where: { id: workspace.id },
        data: {
          plan,
          tokenBudget: planBudget(plan),
        },
      });
      return jsonOk({
        mock: true,
        provider: "mock",
        plan: updated.plan,
        tokenBudget: updated.tokenBudget,
      });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

    if (provider === "whop") {
      const checkout = await createWhopCheckout({
        workspaceId: workspace.id,
        plan,
        origin,
      });
      return jsonOk({ url: checkout.url, mock: false, provider: "whop" });
    }

    const stripe = getStripe();
    const price = priceIdForPlan(plan);
    if (!stripe || !price) {
      return NextResponse.json(
        {
          error:
            "Live billing is not configured. Set WHOP_API_KEY (preferred) or STRIPE_SECRET_KEY and price IDs, or keep BILLING_MOCK=true.",
        },
        { status: 400 },
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/desk/${workspace.id}/billing?status=success&plan=${plan}`,
      cancel_url: `${origin}/desk/${workspace.id}/billing?status=cancelled`,
      metadata: {
        workspaceId: workspace.id,
        plan,
      },
    });

    return jsonOk({ url: session.url, mock: false, provider: "stripe" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Choose Starter, Pro, or Ultra." }, { status: 400 });
    }
    return jsonError(error);
  }
}
