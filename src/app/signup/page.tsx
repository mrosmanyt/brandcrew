import type { Metadata } from "next";
import { SignupScreen } from "./signup-screen";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Get started",
  description: "Create a CINEM Pro account and open the AI employee desk.",
};

export default function SignupPage() {
  return <SignupScreen />;
}
