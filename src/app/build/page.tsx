import type { Metadata } from "next";
import { BuilderGuestShowcase } from "@/components/builder/builder-guest-showcase";
import { SiteBuilder } from "@/components/builder/site-builder";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Website Builder — CINEM Pro",
  description:
    "Describe your business and CINEM Pro builds a complete one-page website you can preview, edit by chatting, and restore to any earlier version.",
};

export default async function BuildPage() {
  const user = await getCurrentUser();
  if (!user) {
    return <BuilderGuestShowcase />;
  }
  return <SiteBuilder userName={user.name} />;
}
