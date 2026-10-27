import Link from "next/link";
import { BrandMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export function NotFoundView({
  homeHref = "/",
  homeLabel = "Home",
}: {
  homeHref?: string;
  homeLabel?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <BrandMark />
      <h1 className="font-heading mt-10 text-3xl tracking-tight">That page is not on the desk.</h1>
      <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
        Check the workspace link or go back home. The desk is still this way.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button nativeButton={false} render={<Link href={homeHref} />}>
          {homeLabel}
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/signup" />}>
          Get started
        </Button>
      </div>
    </div>
  );
}
