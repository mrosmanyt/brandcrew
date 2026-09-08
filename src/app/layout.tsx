import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Analytics } from "@/components/site/analytics";
import { CookieBanner } from "@/components/site/cookie-banner";
import { DESK_THEME_STORAGE_KEY } from "@/lib/desk-theme";
import { COMPANY_NAME, PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/constants";
import { COMPANY_SITE, siteOrigin } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = `${PRODUCT_NAME} — ${PRODUCT_TAGLINE}`;
const description =
  "CINEM Pro is an AI employee desk from CINEM. Create agents, give them jobs, and approve what leaves.";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: title,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description,
  applicationName: PRODUCT_NAME,
  authors: [{ name: COMPANY_NAME, url: COMPANY_SITE }],
  keywords: [PRODUCT_NAME, COMPANY_NAME, "AI employee desk", "AI agents"],
  openGraph: {
    title,
    description:
      "AI employee desk. Create agents, connect Gmail and Slack for real, run jobs with tools — then approve what leaves.",
    siteName: PRODUCT_NAME,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: "/brand/cinem-mark.svg", type: "image/svg+xml" }],
    apple: "/apple-icon",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey={DESK_THEME_STORAGE_KEY}
        >
          <TooltipProvider>
            {children}
            <CookieBanner />
            <Analytics />
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
