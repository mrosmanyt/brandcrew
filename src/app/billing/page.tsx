import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { authHrefWithNext, workspaceBillingHref } from "@/lib/billing-ui";
import {
  assistantBillingPath,
  parseAssistantBillingPlanId,
} from "@/lib/cinem-ai-assistant-billing";
import {
  assistantCheckoutPlanFromQuery,
  cinemAiAssistantUpgradeUrl,
  isCinemAiAssistantProduct,
} from "@/lib/cinem-ai-assistant";
import { createDemoWorkspace, listUserWorkspaces, withMemberRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * Billing deep links.
 * Assistant product → standalone /cinem-ai-assistant/billing (separate from desk plans).
 * Legacy desk plan query params still redirect to workspace billing when product is absent.
 */
export default async function BillingDeepLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; product?: string }>;
}) {
  const query = await searchParams;
  const product = query.product?.trim() || "";
  const assistantPlan = parseAssistantBillingPlanId(query.plan);
  const isAssistant = isCinemAiAssistantProduct(product) || Boolean(assistantPlan);

  if (isAssistant) {
    const plan = assistantPlan || "monthly";
    const selfPath = assistantBillingPath(plan);
    const user = await getCurrentUser();
    if (!user) {
      redirect(authHrefWithNext("/login", selfPath));
    }
    redirect(selfPath);
  }

  const checkoutPlan =
    assistantCheckoutPlanFromQuery(query.plan, product) || "starter";
  const selfPath = cinemAiAssistantUpgradeUrl(undefined, query.plan?.trim() || "pro");

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
