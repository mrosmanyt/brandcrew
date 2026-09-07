"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  FileText,
  LayoutGrid,
  Loader2,
  Mic,
  Paperclip,
  Plug,
  Plus,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  clipComposerText,
  composeJobMessage,
  COMPOSER_PLUS_ITEMS,
  connectorStatusLabel,
  isComposerTextFile,
  type ComposerAttachment,
} from "@/lib/composer";
import { marketplaceBotsHref, type JobChip } from "@/lib/constants";
import type { SkillDTO } from "@/lib/job-types";
import { MARKETPLACE_PLUGINS } from "@/lib/marketplace";
import { cn } from "@/lib/utils";

type ConnectorRow = {
  id: string;
  name: string;
  connected: boolean;
};

export function ChatComposer({
  workspaceId,
  value,
  onChange,
  onSubmit,
  busy,
  disabled,
  placeholder,
  usageLabel,
  skills,
  roleChips,
  marketplaceChips,
  onRunSkill,
  onRunChip,
  onRecordSkill,
}: {
  workspaceId: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: string) => void;
  busy?: boolean;
  disabled?: boolean;
  placeholder: string;
  usageLabel: string;
  skills: SkillDTO[];
  roleChips: JobChip[];
  marketplaceChips: JobChip[];
  onRunSkill: (skill: SkillDTO) => void;
  onRunChip: (chip: JobChip) => void;
  onRecordSkill: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [connectors, setConnectors] = useState<ConnectorRow[]>(
    MARKETPLACE_PLUGINS.map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      connected: false,
    })),
  );
  const pluginsHref = `/desk/${workspaceId}/marketplace?tab=plugins`;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/workspaces/${workspaceId}/plugins`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      const rows = Array.isArray(data.plugins) ? data.plugins : [];
      setConnectors(
        MARKETPLACE_PLUGINS.map((plugin) => {
          const live = rows.find(
            (row: { pluginId?: string; connected?: boolean }) =>
              row.pluginId === plugin.id,
          );
          return {
            id: plugin.id,
            name: plugin.name,
            connected: Boolean(live?.connected),
          };
        }),
      );
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function addFiles(list: FileList | File[] | null) {
    if (!list?.length) return;
    const next: ComposerAttachment[] = [];
    for (const file of Array.from(list)) {
      if (isComposerTextFile(file)) {
        next.push({
          name: file.name,
          size: file.size,
          text: clipComposerText(await file.text()),
        });
      } else {
        next.push({ name: file.name, size: file.size });
      }
    }
    setAttachments((prev) => [...prev, ...next]);
  }

  function send() {
    const message = composeJobMessage(value, attachments);
    if (!message || disabled || busy) return;
    onSubmit(message);
    setAttachments([]);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="shrink-0 px-4 pt-2 pb-4"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "u") {
          e.preventDefault();
          fileRef.current?.click();
        }
      }}
    >
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[28px] border border-[#d6d2ca] bg-[#eceae4] text-zinc-900 shadow-[0_12px_40px_rgba(0,0,0,0.28)]">
          {attachments.length ? (
            <ul className="flex flex-wrap gap-1.5 px-3 pt-3">
              {attachments.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-1 rounded-full bg-zinc-900/8 px-2 py-0.5 text-[11px] text-zinc-800"
                >
                  <span className="max-w-[10rem] truncate">{file.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    className="rounded-full p-0.5 text-zinc-500 hover:text-zinc-900"
                    onClick={() =>
                      setAttachments((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            disabled={busy || disabled}
            className="min-h-[4.5rem] resize-none border-0 bg-transparent px-4 pt-3.5 pb-1 text-[15px] text-zinc-900 shadow-none placeholder:text-zinc-500 focus-visible:ring-0 dark:bg-transparent"
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="grid size-8 place-items-center rounded-full bg-zinc-900/8 text-zinc-800 hover:bg-zinc-900/12"
                aria-label="Open composer menu"
                title="Add"
              >
                <Plus className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                sideOffset={8}
                className="min-w-64"
              >
                <DropdownMenuItem
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip className="size-4" />
                  {COMPOSER_PLUS_ITEMS[0].label}
                  <DropdownMenuShortcut>Ctrl U</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onRecordSkill}>
                  <Video className="size-4" />
                  {COMPOSER_PLUS_ITEMS[1].label}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FileText className="size-4" />
                    {COMPOSER_PLUS_ITEMS[2].label}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-56">
                    {roleChips.map((chip) => (
                      <DropdownMenuItem
                        key={`${chip.action}-${chip.label}`}
                        onClick={() => onRunChip(chip)}
                      >
                        {chip.label}
                      </DropdownMenuItem>
                    ))}
                    {skills.map((skill) => (
                      <DropdownMenuItem
                        key={skill.id}
                        onClick={() => onRunSkill(skill)}
                      >
                        Run {skill.name}
                      </DropdownMenuItem>
                    ))}
                    {marketplaceChips.map((chip) => (
                      <DropdownMenuItem
                        key={chip.label}
                        onClick={() =>
                          router.push(chip.href || marketplaceBotsHref(workspaceId))
                        }
                      >
                        {chip.label}
                      </DropdownMenuItem>
                    ))}
                    {!roleChips.length && !skills.length && !marketplaceChips.length ? (
                      <DropdownMenuItem
                        onClick={() => router.push(marketplaceBotsHref(workspaceId))}
                      >
                        Browse Marketplace skills
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <LayoutGrid className="size-4" />
                    {COMPOSER_PLUS_ITEMS[3].label}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-56">
                    {connectors.map((plugin) => (
                      <DropdownMenuItem
                        key={plugin.id}
                        onClick={() => router.push(pluginsHref)}
                      >
                        <span className="min-w-0 flex-1 truncate">{plugin.name}</span>
                        <span
                          className={cn(
                            "ml-3 text-[11px]",
                            plugin.connected
                              ? "text-emerald-400"
                              : "text-muted-foreground",
                          )}
                        >
                          {connectorStatusLabel(plugin.connected)}
                        </span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push(pluginsHref)}>
                      Open Marketplace connectors
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem onClick={() => router.push(pluginsHref)}>
                  <Plug className="size-4" />
                  {COMPOSER_PLUS_ITEMS[4].label}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="grid size-8 place-items-center rounded-full bg-zinc-900/8 text-zinc-700 hover:bg-zinc-900/12"
                aria-label="Voice input (not available yet)"
                title="Voice input is not wired yet"
                onClick={() =>
                  toast.message("Voice input is not available in this build.")
                }
              >
                <Mic className="size-4" />
              </button>
              <button
                type="submit"
                disabled={busy || disabled || !composeJobMessage(value, attachments)}
                className="grid size-8 place-items-center rounded-full bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-35"
                aria-label="Send"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4 stroke-[2.5]" />
                )}
              </button>
            </div>
          </div>
        </div>
        <p className="mt-2 px-1 text-xs text-muted-foreground">{usageLabel}</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        hidden
        multiple
        accept="image/*,.pdf,.txt,.md,.csv,.json,.html,.css,.js,.ts"
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </form>
  );
}
