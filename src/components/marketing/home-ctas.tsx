"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSignedIn } from "@/components/marketing/use-signed-in";

export function HomeHeroCtas() {
  const signedIn = useSignedIn();
  const href = signedIn ? "/desk" : "/signup";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="lg"
        className="mkt-cta-pulse h-11 px-5"
        nativeButton={false}
        render={<Link href={href} />}
      >
        {signedIn ? "Open desk" : "Get started"}
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="h-11 px-5"
        nativeButton={false}
        render={<Link href="/#download" />}
      >
        Download desktop
      </Button>
    </div>
  );
}

export function HomeFooterCta() {
  const signedIn = useSignedIn();
  const href = signedIn ? "/desk" : "/signup";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="lg"
        className="h-11 px-5"
        nativeButton={false}
        render={<Link href={href} />}
      >
        {signedIn ? "Open desk" : "Get started"}
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="h-11 px-5"
        nativeButton={false}
        render={<Link href="/#download" />}
      >
        Get desktop
      </Button>
    </div>
  );
}

export function GetStartedButton({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const signedIn = useSignedIn();
  const href = signedIn ? "/desk" : "/signup";
  return (
    <Button
      size="lg"
      className={className ?? "h-11 px-5"}
      nativeButton={false}
      render={<Link href={href} />}
    >
      {children ?? (signedIn ? "Open desk" : "Get started")}
    </Button>
  );
}
