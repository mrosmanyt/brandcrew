import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Analytics } from "@/components/site/analytics";
import { CookieBanner } from "@/components/site/cookie-banner";
import { HelpWidgetHost } from "@/components/help/help-widget";
import { DESK_THEME_STORAGE_KEY } from "@/lib/desk-theme";
import { COMPANY_NAME, PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/constants";
import {
  CINEM_LOGO_SRC,
  CINEM_MARK_SRC,
  CINEM_OG_SRC,
} from "@/lib/cinem-mark";
import { COMPANY_SITE, siteOrigin } from "@/lib/site";
import { WHOP_PIXEL_SNIPPET } from "@/lib/whop-pixel";
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
    images: [
      {
        url: CINEM_OG_SRC,
        width: 1200,
        height: 630,
        alt: `${PRODUCT_NAME} — ${PRODUCT_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [CINEM_OG_SRC],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: CINEM_MARK_SRC, type: "image/svg+xml" },
      { url: CINEM_LOGO_SRC, type: "image/png", sizes: "1024x1024" },
      { url: "/icon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Native head script: Whop's detector reads the HTML snippet. */}
        <script
          id="whop-pixel"
          dangerouslySetInnerHTML={{ __html: WHOP_PIXEL_SNIPPET }}
        />
      </head>
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
            <HelpWidgetHost />
            <CookieBanner />
            <Analytics />
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
