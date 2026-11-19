import type { Metadata } from "next";
import { SignupScreen } from "./signup-screen";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Get started",
  description: "Create a CINEM Pro account for AI chat and image generation.",
};

export default function SignupPage() {
  return <SignupScreen />;
}
