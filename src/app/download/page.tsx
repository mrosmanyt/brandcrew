import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/home-sections";
import { Button } from "@/components/ui/button";
import {
  CINEM_AI_ASSISTANT_NAME,
  CINEM_AI_ASSISTANT_PATH,
  CINEM_AI_ASSISTANT_SETUP_FILENAME,
  CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME,
  cinemAiAssistantAdvancedDownloadHref,
  cinemAiAssistantBillingPath,
  cinemAiAssistantDownloadHref,
} from "@/lib/cinem-ai-assistant";
import {
  ANDROID_PACKAGE_ID,
  ANDROID_PLAY_URL,
  CHROME_EXTENSION_API,
  CHROME_EXTENSION_ZIP,
  DESKTOP_WIN_DOWNLOAD,
  DESKTOP_WIN_PORTABLE,
  WIN_PORTABLE_FILENAME,
  WIN_SETUP_FILENAME,
} from "@/lib/site";
import { CHROME_WEB_STORE_URL } from "@/lib/auth-bridge";
import { EXTENSION_ZIP_PUBLIC_PATH } from "@/lib/extension-download";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Download CINEM Pro",
  description:
    "Get CINEM Pro on Windows, Android, and Chrome. Same account as the website.",
};

export default function DownloadPage() {
  return (
    <MarketingShell>
      <SiteNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <p className="text-sm text-muted-foreground">CINEM Pro · Get the apps</p>
        <h1 className="font-heading mt-3 text-4xl tracking-tight md:text-5xl">
          Desktop, Android, and Chrome
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          One account. Sign in on the website, then use the same login on
          desktop, the Android app, and the Chrome extension. Web cookies stay
          on the web; native apps use the same auth API.
        </p>

        <article className="mkt-card-hover mt-12 flex flex-col rounded-xl border border-border bg-card p-6 md:flex-row md:items-center md:justify-between md:gap-8">
          <div className="max-w-xl">
            <p className="text-sm text-muted-foreground">Windows · one installer</p>
            <h2 className="mt-2 text-lg font-medium tracking-tight">
              CINEM Pro desk + {CINEM_AI_ASSISTANT_NAME}
            </h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Install once. Open Desk (cloud at{" "}
              <code className="font-mono text-xs">app.cinem.tech</code>), AI Assistant, or
              both. Same CINEM Pro login and plans. Installer{" "}
              <code className="font-mono text-xs">{CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME}</code>.
              Unsigned builds: SmartScreen → More info → Run anyway.
            </p>
          </div>
          <div className="mt-6 flex shrink-0 flex-col gap-2 md:mt-0">
            <Button
              size="lg"
              className="h-11"
              nativeButton={false}
              render={
                <a
                  href={cinemAiAssistantDownloadHref()}
                  download={WIN_SETUP_FILENAME}
                />
              }
            >
              Get CINEM Pro
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11"
              nativeButton={false}
              render={<Link href={CINEM_AI_ASSISTANT_PATH} />}
            >
              Assistant product page
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="h-11"
              nativeButton={false}
              render={<Link href={cinemAiAssistantBillingPath("pro")} />}
            >
              Upgrade to Pro
            </Button>
          </div>
        </article>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <article className="mkt-card-hover flex flex-col rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">Windows</p>
            <h2 className="mt-2 text-lg font-medium tracking-tight">Same Setup.exe</h2>
            <p className="mt-2 flex-1 text-sm leading-7 text-muted-foreground">
              Portable copy of the same unified app. Menu and chrome switch Desk / AI
              Assistant.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button
                size="lg"
                className="h-11"
                nativeButton={false}
                render={<a href={DESKTOP_WIN_DOWNLOAD} download={WIN_SETUP_FILENAME} />}
              >
                Get desktop
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11"
                nativeButton={false}
                render={<a href={DESKTOP_WIN_PORTABLE} download={WIN_PORTABLE_FILENAME} />}
              >
                Portable .exe
              </Button>
            </div>
          </article>

          <article className="mkt-card-hover flex flex-col rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">Android</p>
            <h2 className="mt-2 text-lg font-medium tracking-tight">Play Store app</h2>
            <p className="mt-2 flex-1 text-sm leading-7 text-muted-foreground">
              Package <code className="font-mono text-xs">{ANDROID_PACKAGE_ID}</code>. Expo
              shell + the same login API, then Mission Control in a WebView.
              iOS App Store is a follow-up. See <code className="font-mono text-xs">docs/play-store-launch.md</code>.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {ANDROID_PLAY_URL ? (
                <Button
                  size="lg"
                  className="h-11"
                  nativeButton={false}
                  render={<a href={ANDROID_PLAY_URL} />}
                >
                  Get Android
                </Button>
              ) : (
                <Button size="lg" className="h-11" nativeButton={false} render={<Link href="/signup" />}>
                  Get Android (web desk today)
                </Button>
              )}
              <p className="text-xs leading-5 text-muted-foreground">
                Play listing is internal testing until the AAB is uploaded. Founder
                build: <code className="font-mono text-xs">cd mobile && npx eas build -p android</code>
              </p>
            </div>
          </article>

          <article className="mkt-card-hover flex flex-col rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">Chrome</p>
            <h2 className="mt-2 text-lg font-medium tracking-tight">On-device extension</h2>
            <p className="mt-2 flex-1 text-sm leading-7 text-muted-foreground">
              MV3 zip with <code className="font-mono text-xs">manifest.json</code> at the
              root. Install, then <strong>Sign in with CINEM</strong> in the popup
              so jobs run as your account — pairing codes still work as a fallback.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {CHROME_WEB_STORE_URL ? (
                <Button
                  size="lg"
                  className="h-11"
                  nativeButton={false}
                  render={<a href={CHROME_WEB_STORE_URL} />}
                >
                  Get Chrome extension
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="h-11"
                  nativeButton={false}
                  render={<a href={EXTENSION_ZIP_PUBLIC_PATH || CHROME_EXTENSION_ZIP} download="cinem-pro-chrome.zip" />}
                >
                  Get Chrome extension
                </Button>
              )}
              <Button
                size="lg"
                variant="outline"
                className="h-11"
                nativeButton={false}
                render={<a href={CHROME_EXTENSION_API} />}
              >
                Alternate zip
              </Button>
            </div>
          </article>
        </div>

        <section className="mt-14 rounded-xl border border-border px-6 py-5">
          <h2 className="text-sm font-medium">Same account</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Use the same CINEM account on the website, desktop, Android, and
            Chrome. Sign in once; your desk and plans follow you.
          </p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Prefer the browser?{" "}
            <Link href="/signup" className="underline underline-offset-4">
              Create an account
            </Link>{" "}
            and open Mission Control on the web. There is no hosted Mac installer
            yet — use the web desk on a Mac.
            Advanced: a Tauri-only{" "}
            <a
              href={cinemAiAssistantAdvancedDownloadHref()}
              className="underline underline-offset-4"
            >
              {CINEM_AI_ASSISTANT_SETUP_FILENAME}
            </a>{" "}
            is optional — not the primary download.
          </p>
        </section>
      </main>
      <SiteFooter />
    </MarketingShell>
  );
}
