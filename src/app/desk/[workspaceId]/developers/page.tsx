import { ApiConsole } from "@/components/desk/api-console";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function DevelopersPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });
  if (!workspace) redirect("/desk");

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8">
      <p className="page-kicker">Developers</p>
      <h1 className="font-heading mt-1 text-2xl">API Console</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Mint a workspace API key and call Brandcrew over HTTPS. Bearer tokens
        never include model provider secrets. On Vercel, browse jobs use fetch
        (Playwright is off).
      </p>
      <div className="mt-6">
        <ApiConsole workspaceId={workspace.id} />
      </div>
    </div>
  );
}
