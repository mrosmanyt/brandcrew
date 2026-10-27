import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConsoleApp } from "@/components/console/console-app";
import { getCurrentUser } from "@/lib/auth";
import { listUserWorkspaces } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "API Console",
  description: "CINEM Pro developer console — workspace API keys, usage, models, and try-it requests.",
};

export default async function ConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/console");
  const workspaces = await listUserWorkspaces(user.id);
  if (!workspaces.length) redirect("/desk");
  const query = await searchParams;
  const requested = query.workspace?.trim() || "";
  const current =
    workspaces.find((row) => row.id === requested) || workspaces[0];

  return (
    <ConsoleApp
      workspaces={workspaces.map((row) => ({
        id: row.id,
        name: row.name,
        plan: row.plan,
      }))}
      initialWorkspaceId={current.id}
    />
  );
}
