import { redirect } from "next/navigation";
import { setSessionCookie } from "@/lib/auth";
import { parseConnectNonce } from "@/lib/auth-bridge";
import { claimConnectTicket } from "@/lib/auth-native";

export const dynamic = "force-dynamic";

/**
 * Mobile / desktop WebView landing: consume an approved session ticket and
 * set the same HttpOnly cookie the website uses, then open Mission Control.
 */
export default async function ConnectSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ nonce?: string; next?: string }>;
}) {
  const query = await searchParams;
  const nonce = parseConnectNonce(query.nonce);
  if (!nonce) redirect("/login");
  const result = await claimConnectTicket(nonce);
  if (result.status !== "approved" || result.payload.type !== "session") {
    redirect(`/connect/mobile?nonce=${nonce}`);
  }
  await setSessionCookie(result.payload.user.id);
  const next =
    query.next && query.next.startsWith("/") && !query.next.startsWith("//")
      ? query.next
      : result.payload.workspaceId
        ? `/desk/${result.payload.workspaceId}`
        : "/desk";
  redirect(next);
}
