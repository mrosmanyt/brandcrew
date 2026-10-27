"use client";

import { useState } from "react";
import {
  AppWindow,
  Layers,
  Lock,
  PenLine,
  Smartphone,
  SquareDashedMousePointer,
} from "lucide-react";
import { BUILD_PROMPT_CATEGORIES } from "@/lib/build-prompt";
import { isDesktopClient } from "@/lib/desktop-client";
import { DesktopBuildRequiredDialog } from "@/components/desk/desktop-build-required-dialog";
import { cn } from "@/lib/utils";

const ICONS = {
  website: AppWindow,
  mobile: Smartphone,
  design: SquareDashedMousePointer,
  slides: Layers,
  content: PenLine,
} as const;

export function BuildSidebarSection({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const locked = !isDesktopClient();

  return (
    <>
      <div className="px-1.5 pt-2">
        {!collapsed ? (
          <p className="px-2 pb-1 text-xs text-sidebar-foreground/45">Build</p>
        ) : null}
        <ul className="space-y-px">
          {BUILD_PROMPT_CATEGORIES.map((category) => {
            const Icon = ICONS[category.id];
            return (
              <li key={category.id}>
                <button
                  type="button"
                  title={
                    locked
                      ? `${category.label} — desktop app required`
                      : category.label
                  }
                  onClick={() => {
                    if (locked) setOpen(true);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    collapsed && "justify-center px-0",
                    locked && "cursor-pointer",
                  )}
                >
                  <Icon className="size-3.5 shrink-0" />
                  {!collapsed ? (
                    <>
                      <span className="min-w-0 flex-1 truncate text-left">{category.label}</span>
                      {locked ? <Lock className="size-3 shrink-0 opacity-50" /> : null}
                    </>
                  ) : locked ? (
                    <Lock className="size-3 opacity-50" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <DesktopBuildRequiredDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
