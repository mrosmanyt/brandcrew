import { redirect } from "next/navigation";
import { OnboardingWelcome } from "@/components/desk/onboarding-welcome";
import { getCurrentUser } from "@/lib/auth";
import { listUserWorkspaces } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const query = await searchParams;
  const workspaces = await listUserWorkspaces(user.id);
  const requested = query.workspace?.trim();
  const workspace =
    (requested ? workspaces.find((row) => row.id === requested) : null) ?? workspaces[0];
  if (!workspace) redirect("/desk");

  return (
    <OnboardingWelcome
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      userName={user.name}
    />
  );
}
