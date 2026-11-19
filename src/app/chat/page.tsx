import type { Metadata } from "next";
import { GuestChatHome } from "@/components/web/guest-chat-home";
import { ChatApp } from "@/components/chat/chat-app";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cinem Pro chat",
  description:
    "Try CINEM Pro cloud chat — multi-model answers, then sign in for the full desk, agents, and approvals.",
};

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) return <GuestChatHome />;
  return <ChatApp userName={user.name} userEmail={user.email} />;
}
