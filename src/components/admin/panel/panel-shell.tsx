"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  ScrollText,
  Settings,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { CinemMark } from "@/components/brand/logo";
import { DeskThemeToggle } from "@/components/desk/theme-toggle";
import { cn } from "@/lib/utils";

const SECTIONS: {
  label: string;
  items: {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    /** "safety" renders the NEW safety-alert count badge next to the label. */
    badge?: "safety";
  }[];
}[] = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Manage",
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/billing", label: "Plans & billing", icon: CreditCard },
      { href: "/admin/support", label: "Support", icon: LifeBuoy },
      { href: "/admin/safety-alerts", label: "Safety alerts", icon: ShieldAlert, badge: "safety" },
      { href: "/admin/studio-packs", label: "Studio packs", icon: Sparkles },
      { href: "/admin/audit", label: "Activity log", icon: ScrollText },
    ],
  },
  {
    label: "System",
    items: [{ href: "/admin/settings", label: "Settings", icon: Settings }],
  },
];

function navActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string, email: string) {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "O") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function PanelShell({
  actorEmail,
  actorName,
  safetyNewCount = 0,
  children,
}: {
  actorEmail: string;
  actorName: string;
  /** NEW safety alerts count, fetched server-side by the admin layout. */
  safetyNewCount?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      {/* Sidebar — dark in both themes, like the reference panel. */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-zinc-950 text-zinc-300 md:flex">
        <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white text-zinc-950">
            <CinemMark className="size-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-wide text-white">
              CINEM Pro
            </span>
            <span className="block text-[10px] font-medium tracking-[0.18em] text-zinc-400">
              ADMIN
            </span>
          </span>
        </div>

        <nav aria-label="Admin panel" className="flex-1 overflow-y-auto px-2.5">
          {SECTIONS.map((section) => (
            <div key={section.label} className="mb-4">
              <p className="px-2 pt-2 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
                {section.label}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = navActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm whitespace-nowrap transition-colors",
                      active
                        ? "bg-white font-medium text-zinc-950"
                        : "text-zinc-300 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                    {item.badge === "safety" && safetyNewCount > 0 ? (
                      <span className="ml-auto rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {safetyNewCount}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="space-y-3 px-4 pt-3 pb-5">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm text-zinc-300 transition-colors hover:text-white"
          >
            <ExternalLink className="size-4" />
            View website
          </a>
          <DeskThemeToggle />
          <p className="text-[11px] leading-4 text-zinc-500">
            Owner-only. Not linked from the product.
          </p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2.5 md:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-zinc-950 text-white">
              <CinemMark className="size-4.5" />
            </span>
            <span className="text-sm font-semibold">CINEM Pro Admin</span>
          </div>
          <p className="hidden text-xs tracking-wide text-muted-foreground uppercase md:block">
            Internal — live data from production
          </p>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-zinc-950 text-[11px] font-semibold text-white dark:bg-white dark:text-zinc-950">
                {initials(actorName, actorEmail)}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block max-w-44 truncate text-[13px] font-medium">
                  {actorName || actorEmail}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  Owner · {actorEmail}
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              aria-label="Log out"
              title="Log out"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </header>

        {/* Mobile nav (sidebar is desktop-only) */}
        <nav
          aria-label="Admin panel"
          className="flex gap-1 overflow-x-auto border-b border-border bg-zinc-950 px-2 py-2 md:hidden"
        >
          {SECTIONS.flatMap((section) => section.items).map((item) => {
            const Icon = item.icon;
            const active = navActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] whitespace-nowrap",
                  active ? "bg-white font-medium text-zinc-950" : "text-zinc-300",
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
                {item.badge === "safety" && safetyNewCount > 0 ? (
                  <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {safetyNewCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
