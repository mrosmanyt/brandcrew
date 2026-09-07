import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createDemoWorkspace, listUserWorkspaces } from "@/lib/workspace";

export default async function DeskIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  let workspaces = await listUserWorkspaces(user.id);
  if (!workspaces.length) {
    const created = await createDemoWorkspace(user.id, `${user.name}'s desk`);
    workspaces = [created];
  }
  redirect(`/desk/${workspaces[0].id}`);
}
