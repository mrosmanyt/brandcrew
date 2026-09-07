"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  Compass,
  CreditCard,
  LayoutGrid,
  ListChecks,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { MISSION_ROLES, employeeDisplayName, type AgentRole } from "@/lib/constants";
import type { WorkspaceDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const AGENT_ICONS: Record<AgentRole, typeof Compass> = {
  strategist: Compass,
  writer: PenLine,
  researcher: Search,
  distributor: CalendarDays,
  sales: Mail,
  ads: Megaphone,
  ops: ListChecks,
};

function StatusDot({ status }: { status?: string }) {
  const color =
    status === "needs-you" || status === "needs_you"
      ? "bg-primary"
      : status === "working" || status === "running" || status === "queued"
        ? "bg-primary animate-pulse"
        : status === "approved"
          ? "bg-emerald-500"
          : status === "draft"
            ? "bg-primary/60"
            : "bg-sidebar-foreground/25";
  return <span className={cn("size-1.5 rounded-full", color)} />;
}

function NavBody({
  workspace,
  workspaces,
  agentStatus,
  collapsed,
  onToggle,
  onLogout,
}: {
  workspace: WorkspaceDTO;
  workspaces: WorkspaceDTO[];
  agentStatus: Record<string, string>;
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setCreating(false);
    if (res.ok) {
      setName("");
      router.push(`/desk/${data.workspace.id}`);
      router.refresh();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-3 py-3">
        {collapsed ? (
          <span className="grid size-7 place-items-center rounded-md bg-sidebar-primary text-[0.7rem] font-semibold text-sidebar-primary-foreground">
            Bc
          </span>
        ) : (
          <BrandMark inverted />
        )}
        <button
          type="button"
          onClick={onToggle}
          className="hidden rounded-md p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent md:block"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>
      </div>

      {!collapsed ? (
        <div className="border-b border-sidebar-border px-3 py-3">
          <label className="px-1 text-[11px] uppercase tracking-[0.14em] text-sidebar-foreground/45">
            Workspace
          </label>
          <select
            className="mt-1 w-full rounded-md border border-sidebar-border bg-sidebar-accent px-2 py-1.5 text-sm text-sidebar-foreground"
            value={workspace.id}
            onChange={(e) => router.push(`/desk/${e.target.value}`)}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <form onSubmit={createWorkspace} className="mt-2 flex gap-1.5">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New workspace"
              className="h-8 border-sidebar-border bg-sidebar-accent text-sidebar-foreground placeholder:text-sidebar-foreground/40"
            />
            <Button
              type="submit"
              size="icon-sm"
              variant="secondary"
              disabled={creating}
              aria-label="Create workspace"
            >
              <Plus className="size-3.5" />
            </Button>
          </form>
        </div>
      ) : null}

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        <div>
          {!collapsed ? (
            <p className="px-2 text-[11px] uppercase tracking-[0.14em] text-sidebar-foreground/45">
              Employees
            </p>
          ) : null}
          <ul className="mt-1 space-y-0.5">
            {MISSION_ROLES.map((role) => {
              const href = `/desk/${workspace.id}?agent=${role}`;
              const onPage = pathname === `/desk/${workspace.id}/${role}`;
              const Icon = AGENT_ICONS[role];
              return (
                <li key={role}>
                  <Link
                    href={href}
                    title={employeeDisplayName(role)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                      collapsed && "justify-center px-0",
                      onPage
                        ? "bg-sidebar-accent text-sidebar-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {!collapsed ? (
                      <>
                        <span className="flex-1 truncate">{employeeDisplayName(role)}</span>
                        <StatusDot status={agentStatus[role]} />
                      </>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          {!collapsed ? (
            <p className="px-2 text-[11px] uppercase tracking-[0.14em] text-sidebar-foreground/45">
              Desk
            </p>
          ) : null}
          <ul className="mt-1 space-y-0.5">
            <SideLink
              href={`/desk/${workspace.id}`}
              pathname={pathname}
              collapsed={collapsed}
              icon={<LayoutGrid className="size-4" />}
            >
              Mission Control
            </SideLink>
            <SideLink
              href={`/desk/${workspace.id}/brand-kit`}
              pathname={pathname}
              collapsed={collapsed}
              icon={<Sparkles className="size-4" />}
            >
              Brand Kit
            </SideLink>
            <SideLink
              href={`/desk/${workspace.id}/calendar`}
              pathname={pathname}
              collapsed={collapsed}
              icon={<CalendarDays className="size-4" />}
            >
              Calendar
            </SideLink>
            <SideLink
              href={`/desk/${workspace.id}/ops`}
              pathname={pathname}
              collapsed={collapsed}
              icon={<ListChecks className="size-4" />}
            >
              Ops board
            </SideLink>
            <SideLink
              href={`/desk/${workspace.id}/billing`}
              pathname={pathname}
              collapsed={collapsed}
              icon={<CreditCard className="size-4" />}
            >
              Plans
            </SideLink>
          </ul>
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={onLogout}
          title="Sign out"
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent",
            collapsed && "justify-center",
          )}
        >
          <LogOut className="size-4" />
          {!collapsed ? "Sign out" : null}
        </button>
      </div>
    </div>
  );
}

function SideLink({
  href,
  pathname,
  icon,
  children,
  collapsed,
}: {
  href: string;
  pathname: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  collapsed: boolean;
}) {
  const active = pathname === href;
  return (
    <li>
      <Link
        href={href}
        title={typeof children === "string" ? children : undefined}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          collapsed && "justify-center px-0",
          active
            ? "bg-sidebar-accent text-sidebar-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
      >
        {icon}
        {!collapsed ? children : null}
      </Link>
    </li>
  );
}

export function DeskSidebar(props: {
  workspace: WorkspaceDTO;
  workspaces: WorkspaceDTO[];
  agentStatus: Record<string, string>;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("brandcrew-sidebar");
    if (stored === "collapsed") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem("brandcrew-sidebar", next ? "collapsed" : "open");
      return next;
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <aside
        className={cn(
          "hidden h-dvh shrink-0 bg-sidebar text-sidebar-foreground transition-[width] md:block",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <NavBody
          {...props}
          collapsed={collapsed}
          onToggle={toggle}
          onLogout={logout}
        />
      </aside>
      <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2 md:hidden">
        <BrandMark />
        <Sheet>
          <SheetTrigger render={<Button variant="outline" size="icon-sm" />}>
            <Menu className="size-4" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <NavBody
              {...props}
              collapsed={false}
              onToggle={() => undefined}
              onLogout={logout}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
