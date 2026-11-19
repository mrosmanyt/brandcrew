"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  CreditCard,
  Image as ImageIcon,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Terminal,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { BrandMark, CinemMark } from "@/components/brand/logo";
import { ConsoleNavLink } from "@/components/desk/console-nav-link";
import {
  ResizeHandle,
  usePersistedCollapsed,
  usePersistedPaneWidth,
} from "@/components/desk/resize-handle";
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
import { isSettingsFamilyPath } from "@/lib/desk-settings";
import { SupporterBadge } from "@/components/support/supporter-badge";
import type { WorkspaceDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

function NavBody({
  workspace,
  workspaces,
  collapsed,
  onToggle,
  onLogout,
}: {
  workspace: WorkspaceDTO;
  workspaces: WorkspaceDTO[];
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [name, setName] = useState("");

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

  function switchWorkspace(id: string) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] === "desk" && parts[1] === workspace.id && parts[2]) {
      router.push(`/desk/${id}/${parts[2]}`);
    } else {
      router.push(`/desk/${id}`);
    }
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
            onChange={(e) => switchWorkspace(e.target.value)}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
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
        <div className="px-1.5 py-2">
          {!collapsed ? (
            <p className="px-2 pb-1 text-xs text-sidebar-foreground/45">Desk</p>
          ) : null}
          <ul className="space-y-px">
            <SideLink
              href="/chat"
              pathname={pathname}
              collapsed={collapsed}
              icon={<MessageSquare className="size-3.5" />}
            >
              Chat
            </SideLink>
            <SideLink
              href={`/desk/${workspace.id}/image-gen`}
              pathname={pathname}
              collapsed={collapsed}
              icon={<ImageIcon className="size-3.5" />}
            >
              Image Gen
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

  const routeKey = `${pathname}?${search}`;
  const [prevRouteKey, setPrevRouteKey] = useState(routeKey);
  if (routeKey !== prevRouteKey) {
    setPrevRouteKey(routeKey);
    setMenuOpen(false);
  }

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
          label="Resize sidebar"
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
