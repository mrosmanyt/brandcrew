"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSignedIn } from "@/components/marketing/use-signed-in";

export function HomeHeroCtas() {
  const signedIn = useSignedIn();
  const href = signedIn ? "/desk" : "/signup";
  return (
    <Button
      size="lg"
      className="h-11 px-5"
      nativeButton={false}
      render={<Link href={href} />}
    >
      {signedIn ? "Open desk" : "Get started"}
    </Button>
  );
}

export function HomeFooterCta() {
  const signedIn = useSignedIn();
  const href = signedIn ? "/desk" : "/signup";
  return (
    <Button
      size="lg"
      className="h-11 px-5"
      nativeButton={false}
      render={<Link href={href} />}
    >
      {signedIn ? "Open desk" : "Get started"}
    </Button>
  );
}
