import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { authHrefWithNext, workspaceBillingHref } from "@/lib/billing-ui";
import {
  assistantCheckoutPlanFromQuery,
  CINEM_AI_ASSISTANT_PRODUCT,
  cinemAiAssistantBillingPath,
} from "@/lib/cinem-ai-assistant";
import { createDemoWorkspace, listUserWorkspaces, withMemberRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * Upgrade deep link for Cinem AI Assistant (and any signed-in checkout).
 * `/billing?plan=pro&product=cinem-ai-assistant` → existing $20 Pro (starter)
 * Whop checkout on the desk billing page. Signed out → login with next= back here.
 */
export default async function BillingDeepLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; product?: string }>;
}) {
  const query = await searchParams;
  const product = query.product?.trim() || CINEM_AI_ASSISTANT_PRODUCT;
  const checkoutPlan =
    assistantCheckoutPlanFromQuery(query.plan, product) ||
    assistantCheckoutPlanFromQuery("pro", CINEM_AI_ASSISTANT_PRODUCT) ||
    "starter";
  const selfPath = cinemAiAssistantBillingPath(query.plan?.trim() || "pro");

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
