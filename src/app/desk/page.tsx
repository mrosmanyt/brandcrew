import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { checkoutPlanFromQuery, workspaceBillingHref } from "@/lib/billing-ui";
import { prisma } from "@/lib/db";
import { createDemoWorkspace, listUserWorkspaces, withMemberRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function DeskIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; plan?: string; companion?: string; action?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  let workspaces = await listUserWorkspaces(user.id);
  if (!workspaces.length) {
    const created = await createDemoWorkspace(user.id, `${user.name}'s desk`);
    workspaces = [withMemberRole(created, "owner")];
    redirect(`/onboarding?workspace=${encodeURIComponent(created.id)}`);
  }
  const query = await searchParams;
  const plan = checkoutPlanFromQuery(query.checkout || query.plan);
  if (plan) {
    redirect(workspaceBillingHref(workspaces[0].id, plan));
  }
  const deskQs = new URLSearchParams();
  if (query.companion) deskQs.set("companion", query.companion);
  if (query.action) deskQs.set("action", query.action);
  const suffix = deskQs.toString() ? `?${deskQs.toString()}` : "";
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: workspaces[0].id, userId: user.id },
    },
    select: { setupWizardDone: true },
  });
  if (membership && !membership.setupWizardDone) {
    redirect(`/onboarding?workspace=${encodeURIComponent(workspaces[0].id)}`);
  }
  redirect(`/desk/${workspaces[0].id}${suffix}`);
}
