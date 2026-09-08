import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminHq } from "@/components/admin/admin-hq";
import { getAdminDashboard, isAdminEmail } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!isAdminEmail(user.email)) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-start px-6 py-16">
        <p className="text-xs tracking-wide text-muted-foreground">403</p>
        <h1 className="font-heading mt-2 text-2xl tracking-tight">Admin access only</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Founder Admin HQ is limited to emails in{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">ADMIN_EMAILS</code>.
        </p>
        <Button className="mt-6" nativeButton={false} render={<Link href="/desk" />}>
          Back to desk
        </Button>
      </div>
    );
  }

  const dashboard = await getAdminDashboard();
  return <AdminHq initial={dashboard} actorEmail={user.email} />;
}
