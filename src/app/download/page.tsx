import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/home-sections";
import { Button } from "@/components/ui/button";
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

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <article className="mkt-card-hover flex flex-col rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">Windows</p>
            <h2 className="mt-2 text-lg font-medium tracking-tight">Desktop app</h2>
            <p className="mt-2 flex-1 text-sm leading-7 text-muted-foreground">
              NSIS installer <code className="font-mono text-xs">{WIN_SETUP_FILENAME}</code>.
              The packaged app is a shell for{" "}
              <code className="font-mono text-xs">https://app.cinem.tech</code> — same
              desk and login as this site. No local database or Postgres. Build:{" "}
              <code className="font-mono text-xs">npm run desktop:build:win</code>.
              Unsigned builds: SmartScreen → More info → Run anyway.
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
            Website login is unchanged (HttpOnly cookie). Desktop and Android
            call <code className="font-mono text-xs">POST /api/auth/token</code> and store a
            refresh token. Chrome opens this site, you approve the workspace, and
            the extension claims an account-linked device token. Details:{" "}
            <code className="font-mono text-xs">docs/auth-bridge.md</code>.
          </p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Prefer the browser?{" "}
            <Link href="/signup" className="underline underline-offset-4">
              Create an account
            </Link>{" "}
            and open Mission Control on the web. Mac .dmg is not hosted from Linux
            CI — build with <code className="font-mono text-xs">npm run desktop:build:mac</code>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </MarketingShell>
  );
}
