import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand/logo";
import { BrandKitForm } from "@/components/desk/brand-kit-form";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { parseBrandKit } from "@/lib/brand-kit";
import { listUserWorkspaces } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const workspaces = await listUserWorkspaces(user.id);
  const workspace = workspaces[0];
  if (!workspace) redirect("/desk");

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <BrandMark />
      <p className="page-kicker mt-10">Onboarding</p>
      <h1 className="font-heading mt-2 text-3xl tracking-tight">Your demo desk is ready.</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Hi {user.name.split(" ")[0]}. We loaded <strong>Northline Studio</strong> —
        a hospitality brand system — so your agents have company facts to write
        from. Edit it now or skip to Mission Control and create an agent.
      </p>
      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <BrandKitForm
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          initial={parseBrandKit(workspace.brandKit)}
        />
      </div>
      <div className="mt-6">
        <Button variant="outline" nativeButton={false} render={<Link href={`/desk/${workspace.id}`} />}>
          Skip to Mission Control
        </Button>
      </div>
    </div>
  );
}
