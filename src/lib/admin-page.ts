import { redirect } from "next/navigation";
import { isAdminEmail, recordAdminAccess } from "@/lib/admin";
import { getCurrentUser, type SessionUser } from "@/lib/auth";

export async function loadAdminPage(nextPath: string): Promise<{
  user: SessionUser;
  allowed: boolean;
}> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${nextPath}`);
  const allowed = isAdminEmail(user.email);
  if (allowed) {
    await recordAdminAccess({ actorEmail: user.email, path: nextPath }).catch(() => undefined);
  }
  return { user, allowed };
}
