import type { Metadata } from "next";
import { ImageStudio } from "@/components/studio/image-studio";
import { ImageStudioGuestShowcase } from "@/components/studio/image-studio-guest-showcase";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Image Studio — CINEM Pro",
  description:
    "Describe an image and CINEM Pro creates it — then edit it, restyle it, change its background and share it, all in one focused studio.",
};

export default async function ImageStudioPage() {
  const user = await getCurrentUser();
  if (!user) {
    return <ImageStudioGuestShowcase />;
  }
  return <ImageStudio userName={user.name} />;
}
