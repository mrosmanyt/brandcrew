import type { Metadata } from "next";
import { PhotoStudio } from "@/components/studio/photo-studio";
import { StudioGuestShowcase } from "@/components/studio/studio-guest-showcase";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Photo Studio — CINEM Pro",
  description:
    "Turn a photo into a professional headshot, fan poster, greeting card and more with CINEM Pro's AI Photo Studio — then share it anywhere.",
};

export default async function StudioPage() {
  const user = await getCurrentUser();
  if (!user) {
    return <StudioGuestShowcase />;
  }
  return <PhotoStudio userName={user.name} />;
}
