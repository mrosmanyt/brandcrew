import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  authHrefWithNext,
  checkoutPlanFromQuery,
  workspaceBillingHref,
} from "@/lib/billing-ui";
import {
  assistantBillingPath,
  parseAssistantBillingPlanId,
} from "@/lib/cinem-ai-assistant-billing";
import { isCinemAiAssistantProduct } from "@/lib/cinem-ai-assistant";
import { createDemoWorkspace, listUserWorkspaces, withMemberRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * Billing deep links.
 * Assistant product (`cinem-ai-assistant` or `assistant`) → standalone assistant billing.
 * An empty product is desk billing, including bare /billing.
 */
export default async function BillingDeepLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; product?: string }>;
}) {
  const query = await searchParams;
  const product = query.product?.trim() || "";
  const isAssistant = isCinemAiAssistantProduct(product);

  if (isAssistant) {
    const plan = parseAssistantBillingPlanId(query.plan) || "monthly";
    const selfPath = assistantBillingPath(plan);
    const user = await getCurrentUser();
    if (!user) {
      redirect(authHrefWithNext("/login", selfPath));
    }
    redirect(selfPath);
  }

  const checkoutPlan = checkoutPlanFromQuery(query.plan) || "starter";
  const selfPath = `/billing?plan=${checkoutPlan}`;

  const user = await getCurrentUser();
  if (!user) {
    redirect(authHrefWithNext("/login", selfPath));
  }

  let workspaces = await listUserWorkspaces(user.id);
  if (!workspaces.length) {
    const created = await createDemoWorkspace(user.id, `${user.name}'s desk`);
    workspaces = [withMemberRole(created, "owner")];
  }

  redirect(workspaceBillingHref(workspaces[0].id, checkoutPlan));
}
