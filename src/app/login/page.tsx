import type { Metadata } from "next";
import { LoginScreen } from "./login-screen";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the CINEM Pro desk.",
};

export default function LoginPage() {
  return <LoginScreen />;
}
