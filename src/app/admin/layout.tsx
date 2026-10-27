import type { ReactNode } from "react";
import Link from "next/link";
import { forbidden, redirect } from "next/navigation";
import { BrandMark } from "@/components/brand/logo";
import { AdminShell } from "@/components/admin/admin-shell";
import { DeskThemeToggle } from "@/components/desk/theme-toggle";
import { Button } from "@/components/ui/button";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!isAdminEmail(user.email)) forbidden();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-12 items-center justify-between gap-3 border-b border-border px-4">
        <Link href="/admin" className="flex items-center gap-2">
          <BrandMark />
          <span className="hidden text-xs text-muted-foreground sm:inline">Admin HQ</span>
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Internal
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/desk" />}>
            Desk
          </Button>
          <DeskThemeToggle />
        </div>
      </header>
      <AdminShell actorEmail={user.email}>{children}</AdminShell>
    </div>
  );
}
