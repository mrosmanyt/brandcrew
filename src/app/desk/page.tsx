import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { checkoutPlanFromQuery, workspaceBillingHref } from "@/lib/billing-ui";
import { createDemoWorkspace, listUserWorkspaces } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function DeskIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; plan?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  let workspaces = await listUserWorkspaces(user.id);
  if (!workspaces.length) {
    const created = await createDemoWorkspace(user.id, `${user.name}'s desk`);
    workspaces = [created];
  }
  const query = await searchParams;
  const plan = checkoutPlanFromQuery(query.checkout || query.plan);
  if (plan) {
    redirect(workspaceBillingHref(workspaces[0].id, plan));
  }
  redirect(`/desk/${workspaces[0].id}`);
}
