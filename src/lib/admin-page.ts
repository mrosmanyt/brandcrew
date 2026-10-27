import { forbidden, redirect } from "next/navigation";
import { isAdminEmail, recordAdminAccess } from "@/lib/admin";
import { getCurrentUser, type SessionUser } from "@/lib/auth";

/**
 * Server gate for every `/admin` page. Non-staff never reach data loaders:
 * unsigned-in → login, signed-in but not ADMIN_EMAILS → HTTP 403 via forbidden().
 * Hiding the Settings link is not this gate.
 */
export async function loadAdminPage(nextPath: string): Promise<{
  user: SessionUser;
}> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${nextPath}`);
  if (!isAdminEmail(user.email)) forbidden();
  await recordAdminAccess({ actorEmail: user.email, path: nextPath }).catch(() => undefined);
  return { user };
}
