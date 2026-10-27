import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy",
  robots: { index: false, follow: true },
};

/** Former SOC/control-inventory page. Visitors go to Privacy — no internals. */
export default function SecurityPage() {
  redirect("/privacy");
}
