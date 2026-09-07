"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignedIn } from "@/components/marketing/use-signed-in";

export function HomeHeroCtas() {
  const signedIn = useSignedIn();
  const href = signedIn ? "/desk" : "/signup";
  return (
    <>
      <Button size="lg" nativeButton={false} render={<Link href={href} />}>
        {signedIn ? "Open Mission Control" : "Start free desk"}
        <ArrowRight className="size-4" />
      </Button>
      <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/#pricing" />}>
        Starter $79 · Growth $199
      </Button>
    </>
  );
}

export function HomePlanCta({
  planName,
  featured,
}: {
  planName: string;
  featured: boolean;
}) {
  const signedIn = useSignedIn();
  const href = signedIn ? "/desk" : "/signup";
  return (
    <Button
      className="mt-6"
      variant={featured ? "default" : "outline"}
      nativeButton={false}
      render={<Link href={href} />}
    >
      {signedIn ? "Open desk" : `Start ${planName}`}
    </Button>
  );
}

export function HomeFooterCta() {
  const signedIn = useSignedIn();
  const href = signedIn ? "/desk" : "/signup";
  return (
    <Button size="lg" nativeButton={false} render={<Link href={href} />}>
      {signedIn ? "Open Mission Control" : "Start free desk"}
      <ArrowRight className="size-4" />
    </Button>
  );
}
