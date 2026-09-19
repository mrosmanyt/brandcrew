import type { Metadata } from "next";
import { GuestChatHome } from "@/components/web/guest-chat-home";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cinem Pro chat",
  description:
    "Try CINEM Pro cloud chat — multi-model answers, then sign in for the full desk, agents, and approvals.",
};

export default function GuestChatPage() {
  return <GuestChatHome />;
}
