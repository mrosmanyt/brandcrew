import Link from "next/link";
import { BrandMark } from "@/components/brand/logo";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";

export const dynamic = "force-static";

export default function NotFound() {
  return (
    <MarketingShell>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <BrandMark />
        <h1 className="font-heading mt-10 text-3xl tracking-tight">That page is not on the desk.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Check the workspace link or go back home.
        </p>
        <Button className="mt-8" nativeButton={false} render={<Link href="/" />}>
          Home
        </Button>
      </div>
    </MarketingShell>
  );
}
