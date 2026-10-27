import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConnectClient } from "@/components/auth/connect-client";
import { isConnectSurface } from "@/lib/auth-bridge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in with CINEM",
  description: "Attach desktop, Android, or Chrome to the same CINEM Pro account.",
  robots: { index: false, follow: false },
};

export default async function ConnectSurfacePage({
  params,
  searchParams,
}: {
  params: Promise<{ surface: string }>;
  searchParams: Promise<{ nonce?: string }>;
}) {
  const { surface } = await params;
  const query = await searchParams;
  if (!isConnectSurface(surface)) notFound();
  return <ConnectClient surface={surface} nonce={query.nonce || ""} />;
}
