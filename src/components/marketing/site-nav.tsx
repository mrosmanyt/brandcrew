"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand/logo";
import { useMarketingAuth } from "@/components/marketing/use-signed-in";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", label: "Assistant" },
  { href: "/cinem-ai-assistant/billing", label: "Pricing" },
  { href: "/about", label: "Cinem Pro" },
  { href: "/download", label: "Download" },
  { href: "/login", label: "Login" },
] as const;

export function SiteNav() {
  const { signedIn, accountHref, deskHref } = useMarketingAuth();
  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
        <Link href="/" className="shrink-0">
          <BrandMark priority />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href={accountHref} />}
              >
                Account
              </Button>
              <Button size="sm" nativeButton={false} render={<Link href={deskHref} />}>
                Open desk
              </Button>
            </>
          ) : (
            <Button size="sm" nativeButton={false} render={<Link href="/signup" />}>
              Get started
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
