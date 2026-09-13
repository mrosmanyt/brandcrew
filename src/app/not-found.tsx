import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { NotFoundView } from "@/components/not-found-view";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Page not found",
  description: "That page is not on the CINEM Pro desk.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <MarketingShell>
      <NotFoundView />
    </MarketingShell>
  );
}
