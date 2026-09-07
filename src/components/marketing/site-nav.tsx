"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand/logo";
import { useSignedIn } from "@/components/marketing/use-signed-in";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#integrations", label: "Connectors" },
  { href: "/#agents", label: "Agents" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#download", label: "Download" },
  { href: "/#pricing", label: "Pricing" },
] as const;

export function SiteNav() {
  const signedIn = useSignedIn();
  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
        <Link href="/" className="shrink-0">
          <BrandMark />
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
            <Button size="sm" nativeButton={false} render={<Link href="/desk" />}>
              Open desk
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/login" />}>
                Sign in
              </Button>
              <Button size="sm" nativeButton={false} render={<Link href="/signup" />}>
                Get started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
