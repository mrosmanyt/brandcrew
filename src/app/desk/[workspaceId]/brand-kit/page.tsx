import { redirect } from "next/navigation";
import { BrandKitForm } from "@/components/desk/brand-kit-form";
import { getCurrentUser } from "@/lib/auth";
import { parseBrandKit } from "@/lib/brand-kit";
import { prisma } from "@/lib/db";

export default async function BrandKitPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) redirect("/desk");

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <p className="page-kicker">Shared memory</p>
      <h1 className="font-heading mt-1 text-2xl">Brand Kit</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Stored as JSON on this workspace. Save, then generate — Writer, Sales,
        and the rest will use this kit immediately. There is no per-agent memory
        in v1.
      </p>
      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <BrandKitForm
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          initial={parseBrandKit(workspace.brandKit)}
        />
      </div>
    </div>
  );
}
