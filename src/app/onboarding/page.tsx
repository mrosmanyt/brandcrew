import { connection as waitForRequest } from "next/server";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/desk/onboarding-wizard";
import { getCurrentUser } from "@/lib/auth";
import { parseBrandKit } from "@/lib/brand-kit";
import { getLlmStatus } from "@/lib/llm";
import { normalizeModelRouting } from "@/lib/llm-routing";
import { listPluginConnections } from "@/lib/plugins";
import { hydrateOnboardingPlugins } from "@/lib/setup-wizard";
import { listUserWorkspaces } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{
    workspace?: string;
    step?: string;
    connected?: string;
    error?: string;
    plugin?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const query = await searchParams;
  const workspaces = await listUserWorkspaces(user.id);
  const requested = query.workspace?.trim();
  const workspace =
    (requested ? workspaces.find((row) => row.id === requested) : null) ?? workspaces[0];
  if (!workspace) redirect("/desk");

  await waitForRequest();
  const connections = await listPluginConnections(workspace.id);

  return (
    <OnboardingWizard
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      initialKit={parseBrandKit(workspace.brandKit)}
      initialStep={query.step}
      initialModelRouting={normalizeModelRouting(
        "modelRouting" in workspace ? String(workspace.modelRouting ?? "") : "",
      )}
      initialPlugins={hydrateOnboardingPlugins(connections)}
      oauthConnected={query.connected ?? null}
      oauthError={query.error ?? null}
      oauthPlugin={query.plugin ?? null}
      llm={getLlmStatus()}
      userName={user.name}
    />
  );
}
