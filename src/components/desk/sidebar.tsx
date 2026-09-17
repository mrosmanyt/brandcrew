"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  CreditCard,
  Heart,
  LayoutGrid,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Terminal,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BrandMark, CinemMark } from "@/components/brand/logo";
import { AgentAvatar } from "@/components/desk/agent-avatar";
import { BuildSidebarSection } from "@/components/desk/build-sidebar-section";
import { ConsoleNavLink } from "@/components/desk/console-nav-link";
import { NotificationBell, type NeedsYouItem } from "@/components/desk/notification-bell";
import { useWorkspaceJobsPoll } from "@/components/desk/use-workspace-jobs-poll";
import {
  ResizeHandle,
  usePersistedCollapsed,
  usePersistedPaneWidth,
} from "@/components/desk/resize-handle";
import { TeamLaunchDialog } from "@/components/desk/team-launch-dialog";
import { DeskThemeToggle } from "@/components/desk/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DESK_LEFT_PANE } from "@/lib/desk-layout";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DEFAULT_AGENT_NAME, displayAgentName } from "@/lib/constants";
import { isSettingsFamilyPath } from "@/lib/desk-settings";
import { SupporterBadge } from "@/components/support/supporter-badge";
import type { AgentDTO } from "@/lib/job-types";
import type { ProposedAgent } from "@/lib/team-launch";
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
  const creatingRef = useRef(false);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [name, setName] = useState("");
  const [polledStatus, setPolledStatus] = useState<Record<string, string> | null>(
    null,
  );
  const liveStatus = polledStatus ?? agentStatus;
  const [launchOpen, setLaunchOpen] = useState(false);
  const [launchProposal, setLaunchProposal] = useState<ProposedAgent[]>([]);
  const [launchBusy, setLaunchBusy] = useState(false);
  const selectedAgentId = searchParams.get("agentId");
  const onMission = pathname === `/desk/${workspace.id}`;
  useWorkspaceJobsPoll(workspace.id, (data) => {
    if (data.employeeStatus && typeof data.employeeStatus === "object") {
      setPolledStatus(data.employeeStatus);
    }
  });

  async function createWorkspace() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast("Enter a workspace name.");
      return;
    }
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, kind: "client", clientName: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        workspace?: { id?: string };
        error?: string;
      };
      if (!res.ok || !data.workspace?.id) {
        toast.error(data.error || "Could not create workspace.");
        return;
      }
      setName("");
      router.push(`/onboarding?workspace=${encodeURIComponent(data.workspace.id)}`);
      router.refresh();
    } catch {
      toast.error("Could not create workspace.");
    } finally {
      creatingRef.current = false;
      setCreating(false);
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

  async function openLaunch() {
    const res = await fetch(`/api/workspaces/${workspace.id}/agents/launch`);
    const data = await res.json();
    setLaunchProposal(data.proposal ?? []);
    setLaunchOpen(true);
  }

  async function approveLaunch(rows: ProposedAgent[], startOnboardingJobs: boolean) {
    setLaunchBusy(true);
    const res = await fetch(`/api/workspaces/${workspace.id}/agents/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agents: rows, startOnboardingJobs }),
    });
    const data = await res.json();
    setLaunchBusy(false);
    if (!res.ok) {
      toast.error(data.error || "Could not create the team.");
      return;
    }
    setLaunchOpen(false);
    toast.success(`Created ${data.created?.length ?? 0} agents.`);
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center justify-between gap-2 px-2.5">
        {collapsed ? (
          <CinemMark
            className="size-6 text-sidebar-foreground"
            title="CINEM Pro"
          />
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
                {w.kind === "client"
                  ? `${w.name}${w.clientName ? ` · ${w.clientName}` : ""}`
                  : w.name}
                {w.supporter || (w.id === workspace.id && workspace.supporter)
                  ? " · Supporter"
                  : ""}
                {w.id === workspace.id && workspace.memberRole ? ` · ${workspace.memberRole}` : ""}
              </option>
            ))}
          </select>
          {workspace.supporter ? (
            <div className="mt-1.5">
              <SupporterBadge />
            </div>
          ) : null}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void createWorkspace();
            }}
            className="mt-1.5 flex gap-1"
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                void createWorkspace();
              }}
              placeholder="New client workspace"
              className="h-7 border-0 bg-sidebar-accent text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40"
            />
            <Button
              type="button"
              size="icon-xs"
              variant="secondary"
              disabled={creating}
              aria-label="Create workspace"
              onClick={() => void createWorkspace()}
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
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={createAgent}
                  disabled={creatingAgent}
                  className="text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground"
                >
                  New
                </button>
                <button
                  type="button"
                  onClick={openLaunch}
                  className="text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground"
                  title="Launch team"
                >
                  Team
                </button>
              </span>
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
              None yet — New Agent, Settings → Marketplace, or Launch team.
            </p>
          ) : (
            <ul className="space-y-px">
              {agents.map((agent) => {
                const href = `/desk/${workspace.id}?agentId=${agent.id}`;
                const active =
                  onMission &&
                  (selectedAgentId === agent.id ||
                    (!selectedAgentId && agent.id === agents[0]?.id));
                const status = liveStatus[agent.id];
                const working =
                  status === "working" || status === "running" || status === "queued";
                return (
                  <li key={agent.id}>
                    <Link
                      href={href}
                      prefetch={false}
                      title={`${displayAgentName(agent.name)}${agent.role ? ` · ${agent.role}` : ""}`}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[13px] transition-colors",
                        collapsed && "justify-center px-0",
                        active
                          ? "bg-sidebar-accent text-sidebar-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                      )}
                    >
                      <AgentAvatar
                        id={agent.id}
                        name={agent.name}
                        role={agent.role}
                        working={working}
                        size="sm"
                      />
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
                          <StatusDot status={status} />
                        </>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <BuildSidebarSection collapsed={collapsed} />

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
            <li>
              <ConsoleNavLink
                workspaceId={workspace.id}
                title="API Console"
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <Terminal className="size-3.5" />
                {!collapsed ? "API Console" : null}
              </ConsoleNavLink>
            </li>
            <SideLink
              href={`/desk/${workspace.id}/usage`}
              pathname={pathname}
              collapsed={collapsed}
              icon={<BarChart3 className="size-3.5" />}
            >
              Usage
            </SideLink>
            <SideLink
              href={`/desk/${workspace.id}/billing`}
              pathname={pathname}
              collapsed={collapsed}
              icon={<CreditCard className="size-3.5" />}
            >
              Plans
            </SideLink>
            <SideLink
              href="/support"
              pathname={pathname}
              collapsed={collapsed}
              icon={<Heart className="size-3.5" />}
            >
              Support
            </SideLink>
            <SideLink
              href={`/desk/${workspace.id}/settings`}
              pathname={pathname}
              collapsed={collapsed}
              active={isSettingsFamilyPath(pathname, workspace.id)}
              icon={<Settings className="size-3.5" />}
            >
              Settings
            </SideLink>
          </ul>
        </div>
      </nav>

      <div className="p-1.5">
        <TeamLaunchDialog
          open={launchOpen}
          onOpenChange={setLaunchOpen}
          proposal={launchProposal}
          busy={launchBusy}
          onApprove={approveLaunch}
        />
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
  active: activeOverride,
}: {
  href: string;
  pathname: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  collapsed: boolean;
  active?: boolean;
}) {
  const active = activeOverride ?? pathname === href;
  return (
    <li>
      <Link
        href={href}
        prefetch={false}
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
  needsYou?: NeedsYouItem[];
  creditsLine?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = usePersistedCollapsed(DESK_LEFT_PANE.collapsedKey);
  const [leftWidth, setLeftWidth] = usePersistedPaneWidth(
    DESK_LEFT_PANE.storageKey,
    DESK_LEFT_PANE.defaultWidth,
    DESK_LEFT_PANE.minWidth,
    DESK_LEFT_PANE.maxWidth,
  );

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, search]);

  function toggle() {
    setCollapsed((value) => !value);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <aside
        className="hidden h-dvh shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block"
        style={{
          width: collapsed ? DESK_LEFT_PANE.collapsedWidth : leftWidth,
        }}
      >
        <NavBody
          {...props}
          collapsed={collapsed}
          onToggle={toggle}
          onLogout={logout}
        />
      </aside>
      {!collapsed ? (
        <ResizeHandle
          label="Resize agents sidebar"
          className="hidden md:flex"
          onDelta={(dx) => setLeftWidth((width) => width + dx)}
          onDoubleClick={toggle}
        />
      ) : null}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 md:hidden">
        <div className="min-w-0">
          <BrandMark />
          {props.creditsLine ? (
            <p className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground">
              {props.creditsLine}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell
            workspaceId={props.workspace.id}
            initialItems={props.needsYou ?? []}
          />
          <DeskThemeToggle />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              render={
                <Button variant="outline" size="sm" aria-label="Open desk menu" />
              }
            >
              <Menu className="size-4" />
              Menu
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
              <SheetHeader className="sr-only">
                <SheetTitle>Desk menu</SheetTitle>
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
      </div>
    </>
  );
}
