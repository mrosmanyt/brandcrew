import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentUser, type SessionUser } from "@/lib/auth";

export async function loadAdminPage(nextPath: string): Promise<{
  user: SessionUser;
  allowed: boolean;
}> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${nextPath}`);
  return { user, allowed: isAdminEmail(user.email) };
}
