import { MarketplaceDesk } from "@/components/desk/marketplace";

export default async function MarketplacePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { workspaceId } = await params;
  const query = await searchParams;
  return <MarketplaceDesk workspaceId={workspaceId} initialTab={query.tab} />;
}
