"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand/logo";
import { useSignedIn } from "@/components/marketing/use-signed-in";
import { Button } from "@/components/ui/button";

export function SiteNav() {
  const signedIn = useSignedIn();
  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
        <Link href="/" className="shrink-0">
          <BrandMark />
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground sm:flex">
          <Link href="/#product" className="transition-colors hover:text-foreground">
            Product
          </Link>
          <Link href="/#how-it-works" className="transition-colors hover:text-foreground">
            How it works
          </Link>
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
