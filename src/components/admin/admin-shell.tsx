"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Flag,
  Funnel,
  KeyRound,
  LayoutDashboard,
  MessageSquareQuote,
  Receipt,
  ScrollText,
  ShieldAlert,
  LifeBuoy,
  Users,
  Cpu,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/billing", label: "Billing", icon: Receipt },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/assistant-queries", label: "Assistant queries", icon: MessageSquareQuote },
  { href: "/admin/models", label: "Model / cost", icon: Cpu },
  { href: "/admin/access", label: "Access", icon: KeyRound },
  { href: "/admin/audit", label: "Audit", icon: ScrollText },
  { href: "/admin/trust", label: "Trust & safety", icon: ShieldAlert },
  { href: "/admin/flags", label: "Feature flags", icon: Flag },
  { href: "/admin/crash-reports", label: "Crash reports", icon: AlertTriangle },
  { href: "/admin/funnel", label: "Conversion funnel", icon: Funnel },
] as const;

function navActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({
  actorEmail,
  children,
}: {
  actorEmail: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <nav
        aria-label="Admin HQ"
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-card/60 px-2 py-2 md:w-52 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r md:px-3 md:py-4"
      >
        <p className="mb-1 hidden px-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase md:block">
          Internal ops
        </p>
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = navActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
        <p className="mt-auto hidden px-2 pt-6 text-[11px] leading-4 text-muted-foreground md:block">
          Signed in as {actorEmail}. Not customer-facing.
        </p>
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
