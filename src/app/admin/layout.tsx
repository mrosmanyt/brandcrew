import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { PanelShell } from "@/components/admin/panel/panel-shell";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";

/** Owner-only panel: never indexed, never advertised. */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  // 404 (not 403) for signed-in non-admins: the panel stays invisible.
  if (!isAdminEmail(user.email)) notFound();

  return (
    <PanelShell actorEmail={user.email} actorName={user.name}>
      {children}
    </PanelShell>
  );
}
