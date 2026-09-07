"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sparkles,
  Store,
  Terminal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { DEFAULT_AGENT_NAME, displayAgentName } from "@/lib/constants";
import type { AgentDTO } from "@/lib/job-types";
import type { WorkspaceDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

function StatusDot({ status }: { status?: string }) {
  const color =
    status === "needs-you" || status === "needs_you"
      ? "bg-amber-400"
      : status === "working" || status === "running" || status === "queued"
        ? "bg-sky-400 animate-pulse"
        : status === "approved"
          ? "bg-emerald-500"
          : status === "draft"
            ? "bg-zinc-400"
            : "bg-sidebar-foreground/20";
  return <span className={cn("size-1.5 shrink-0 rounded-full", color)} />;
}

function NavBody({
  workspace,
  workspaces,
  agents,
  agentStatus,
  collapsed,
  onToggle,
  onLogout,
}: {
  workspace: WorkspaceDTO;
  workspaces: WorkspaceDTO[];
  agents: AgentDTO[];
  agentStatus: Record<string, string>;
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [name, setName] = useState("");
  const selectedAgentId = searchParams.get("agentId");
  const onMission = pathname === `/desk/${workspace.id}`;

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

  async function createAgent() {
    setCreatingAgent(true);
    const res = await fetch(`/api/workspaces/${workspace.id}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: DEFAULT_AGENT_NAME, role: "" }),
    });
    const data = await res.json();
    setCreatingAgent(false);
    if (!res.ok) {
      toast.error(data.error || "Could not create an agent.");
      return;
    }
    router.push(`/desk/${workspace.id}?agentId=${data.agent.id}`);
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center justify-between gap-2 px-2.5">
        {collapsed ? (
          <span className="grid size-6 place-items-center rounded-[6px] bg-sidebar-primary text-[0.65rem] font-semibold text-sidebar-primary-foreground">
            CP
          </span>
        ) : (
          <BrandMark inverted />
        )}
        <button
          type="button"
          onClick={onToggle}
          className="hidden rounded-md p-1 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground md:block"
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
        <div className="px-2.5 pb-2">
          <select
            aria-label="Workspace"
            className="w-full rounded-md border-0 bg-sidebar-accent px-2 py-1.5 text-xs text-sidebar-foreground"
            value={workspace.id}
            onChange={(e) => router.push(`/desk/${e.target.value}`)}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <form onSubmit={createWorkspace} className="mt-1.5 flex gap-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New workspace"
              className="h-7 border-0 bg-sidebar-accent text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40"
            />
            <Button
              type="submit"
              size="icon-xs"
              variant="secondary"
              disabled={creating}
              aria-label="Create workspace"
            >
              <Plus className="size-3.5" />
            </Button>
          </form>
        </div>
      ) : null}

      <nav className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-2">
          {!collapsed ? (
            <div className="mb-1 flex items-center justify-between px-2">
              <p className="text-xs text-sidebar-foreground/45">Agents</p>
              <button
                type="button"
                onClick={createAgent}
                disabled={creatingAgent}
                className="text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground"
              >
                New
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={createAgent}
              disabled={creatingAgent}
              title="New Agent"
              className="mb-1 flex w-full items-center justify-center rounded-md py-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <Plus className="size-3.5" />
            </button>
          )}
          {agents.length === 0 && !collapsed ? (
            <p className="px-2 pt-1 text-[11px] leading-4 text-sidebar-foreground/45">
              None yet — New Agent, Marketplace, or Launch team.
            </p>
          ) : (
            <ul className="space-y-px">
              {agents.map((agent) => {
                const href = `/desk/${workspace.id}?agentId=${agent.id}`;
                const active =
                  onMission &&
                  (selectedAgentId === agent.id ||
                    (!selectedAgentId && agent.id === agents[0]?.id));
                const initial = displayAgentName(agent.name).slice(0, 1).toUpperCase();
                return (
                  <li key={agent.id}>
                    <Link
                      href={href}
                      title={`${displayAgentName(agent.name)}${agent.role ? ` · ${agent.role}` : ""}`}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[13px] transition-colors",
                        collapsed && "justify-center px-0",
                        active
                          ? "bg-sidebar-accent text-sidebar-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded-md text-[10px] font-medium",
                          active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "bg-sidebar-accent text-sidebar-foreground",
                        )}
                      >
                        {initial}
                      </span>
                      {!collapsed ? (
                        <>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate leading-4">
                              {displayAgentName(agent.name)}
                            </span>
                            {agent.role ? (
                              <span className="block truncate text-[10px] leading-3 text-sidebar-foreground/40">
                                {agent.role}
                              </span>
                            ) : null}
                          </span>
                          <StatusDot status={agentStatus[agent.id]} />
                        </>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-1.5 py-2">
          {!collapsed ? (
            <p className="px-2 pb-1 text-xs text-sidebar-foreground/45">Desk</p>
          ) : null}
          <ul className="space-y-px">
            <SideLink
              href={`/desk/${workspace.id}`}
              pathname={pathname}
              collapsed={collapsed}
              icon={<LayoutGrid className="size-3.5" />}
            >
              Mission Control
            </SideLink>
            <SideLink
              href={`/desk/${workspace.id}/marketplace`}
              pathname={pathname}
              collapsed={collapsed}
              icon={<Store className="size-3.5" />}
            >
              Marketplace
            </SideLink>
            <SideLink
              href={`/desk/${workspace.id}/brand-kit`}
              pathname={pathname}
              collapsed={collapsed}
              icon={<Sparkles className="size-3.5" />}
            >
              Brand Kit
            </SideLink>
            <SideLink
              href={`/desk/${workspace.id}/calendar`}
              pathname={pathname}
              collapsed={collapsed}
              icon={<CalendarDays className="size-3.5" />}
            >
              Calendar
            </SideLink>
            <SideLink
              href={`/desk/${workspace.id}/ops`}
              pathname={pathname}
              collapsed={collapsed}
              icon={<ListChecks className="size-3.5" />}
            >
              Ops board
            </SideLink>
            <SideLink
              href={`/desk/${workspace.id}/developers`}
              pathname={pathname}
              collapsed={collapsed}
              icon={<Terminal className="size-3.5" />}
            >
              API Console
            </SideLink>
            <SideLink
              href={`/desk/${workspace.id}/billing`}
              pathname={pathname}
              collapsed={collapsed}
              icon={<CreditCard className="size-3.5" />}
            >
              Plans
            </SideLink>
          </ul>
        </div>
      </nav>

      <div className="p-1.5">
        <button
          type="button"
          onClick={onLogout}
          title="Sign out"
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "justify-center",
          )}
        >
          <LogOut className="size-3.5" />
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
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
          collapsed && "justify-center px-0",
          active
            ? "bg-sidebar-accent text-sidebar-foreground"
            : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground",
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
  agents: AgentDTO[];
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
          "hidden h-dvh shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] md:block",
          collapsed ? "w-14" : "w-60",
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
