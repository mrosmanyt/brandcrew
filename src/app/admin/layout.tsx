import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/logo";
import { DeskThemeToggle } from "@/components/desk/theme-toggle";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-12 items-center justify-between gap-3 border-b border-border px-4">
        <Link href="/admin" className="flex items-center gap-2">
          <BrandMark />
          <span className="hidden text-xs text-muted-foreground sm:inline">Founder HQ</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/desk" />}>
            Desk
          </Button>
          <DeskThemeToggle />
        </div>
      </header>
      {children}
    </div>
  );
}
