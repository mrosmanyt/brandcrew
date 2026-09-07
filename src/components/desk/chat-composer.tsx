"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AppWindow,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  FileText,
  LayoutGrid,
  Layers,
  Loader2,
  Mic,
  Paperclip,
  Plug,
  Plus,
  RefreshCw,
  Smartphone,
  SquareDashedMousePointer,
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
  AgentModesMenu,
  applyWorkspacePlan,
} from "@/components/desk/agent-modes-menu";
import { JobStartingStatus } from "@/components/desk/job-starting-status";
import {
  clipComposerText,
  composeJobMessage,
  COMPOSER_PLUS_ITEMS,
  connectorStatusLabel,
  isComposerTextFile,
  type ComposerAttachment,
} from "@/lib/composer";
import { nextAgentModePlan, planModeName } from "@/lib/agent-modes";
import {
  BUILD_PROMPT_CATEGORIES,
  BUILD_PROMPT_HEADLINE,
  BUILD_PROMPT_SUBCOPY,
  chipPage,
  composerPlaceholder,
  nextChipSetIndex,
  resolveBuildPromptIntent,
  type BuildPromptCategoryId,
  type BuildPromptIntent,
} from "@/lib/build-prompt";
import { marketplaceBotsHref, PLANS, type JobChip, type PlanId } from "@/lib/constants";
import type { SkillDTO } from "@/lib/job-types";
import type { LlmRoutingPreference, LlmStatus } from "@/lib/llm-routing";
import { MARKETPLACE_PLUGINS } from "@/lib/marketplace";
import { cn } from "@/lib/utils";

type ConnectorRow = {
  id: string;
  name: string;
  connected: boolean;
};

const CATEGORY_ICONS = {
  website: AppWindow,
  mobile: Smartphone,
  design: SquareDashedMousePointer,
  slides: Layers,
  animation: Clapperboard,
} as const;

export function ChatComposer({
  workspaceId,
  value,
  onChange,
  onSubmit,
  busy,
  disabled,
  showHero,
  usageLabel,
  skills,
  roleChips,
  marketplaceChips,
  onRunSkill,
  onRunChip,
  onRecordSkill,
  plan,
  billingMock,
  llm,
  modelRouting,
  workingStatus,
  onPlanApplied,
  onRoutingApplied,
}: {
  workspaceId: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: string, intent: BuildPromptIntent) => void;
  busy?: boolean;
  disabled?: boolean;
  showHero?: boolean;
  usageLabel: string;
  skills: SkillDTO[];
  roleChips: JobChip[];
  marketplaceChips: JobChip[];
  onRunSkill: (skill: SkillDTO) => void;
  onRunChip: (chip: JobChip) => void;
  onRecordSkill: () => void;
  plan: string;
  billingMock: boolean;
  llm: LlmStatus;
  modelRouting: string;
  workingStatus?: "queued" | "running" | null;
  onPlanApplied?: (next: { plan: PlanId; tokenBudget: number }) => void;
  onRoutingApplied?: (next: LlmRoutingPreference) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const categoryScroller = useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [categoryId, setCategoryId] = useState<BuildPromptCategoryId>("website");
  const [chipId, setChipId] = useState<string | null>(null);
  const [chipSet, setChipSet] = useState(0);
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

  const intent = resolveBuildPromptIntent({ categoryId, chipId });
  const placeholder = composerPlaceholder({ disabled, categoryId });
  const readyMessage = composeJobMessage(value, attachments);
  const canSend = Boolean(readyMessage || intent.action !== "default");
  const exampleChips = chipPage(chipSet);

  function send() {
    if (disabled || busy || !canSend) return;
    onSubmit(readyMessage, intent);
    setAttachments([]);
    setChipId(null);
  }

  function selectCategory(id: BuildPromptCategoryId) {
    setCategoryId(id);
    setChipId(null);
  }

  function scrollCategories(direction: -1 | 1) {
    categoryScroller.current?.scrollBy({ left: direction * 160, behavior: "smooth" });
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
        if (
          (e.ctrlKey || e.metaKey) &&
          e.shiftKey &&
          e.key.toLowerCase() === "i"
        ) {
          e.preventDefault();
          const next = nextAgentModePlan(plan);
          void applyWorkspacePlan({
            workspaceId,
            next,
            current: plan,
            billingMock,
          })
            .then((result) => {
              if (result.action === "open-plans") {
                toast.message("Open Plans to change a live subscription.");
                router.push(`/desk/${workspaceId}/billing`);
                return;
              }
              if (result.url) {
                window.location.href = result.url;
                return;
              }
              if (result.action === "noop") return;
              onPlanApplied?.({
                plan: result.plan,
                tokenBudget: result.tokenBudget ?? PLANS[result.plan].tokenBudget,
              });
              toast.success(`Agent mode: ${planModeName(result.plan)}`);
              router.refresh();
            })
            .catch((error: unknown) => {
              toast.error(
                error instanceof Error ? error.message : "Could not change plan.",
              );
            });
        }
      }}
    >
      <div className="mx-auto max-w-3xl">
        {showHero !== false ? (
          <div className="mb-4 px-1 text-center">
            <h2 className="font-heading text-[1.65rem] leading-tight tracking-tight text-foreground sm:text-3xl">
              {BUILD_PROMPT_HEADLINE}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{BUILD_PROMPT_SUBCOPY}</p>
          </div>
        ) : null}
        {workingStatus ? (
          <JobStartingStatus status={workingStatus} className="mb-2 px-1" />
        ) : null}
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 -top-8 h-24 rounded-full bg-composer-send/12 blur-3xl dark:bg-white/6"
          />
          <div className="relative rounded-[28px] border border-composer-border bg-composer text-composer-foreground shadow-[var(--composer-shadow)]">
          {attachments.length ? (
            <ul className="flex flex-wrap gap-1.5 px-3 pt-3">
              {attachments.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-1 rounded-full bg-composer-control px-2 py-0.5 text-[11px] text-composer-foreground"
                >
                  <span className="max-w-[10rem] truncate">{file.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    className="rounded-full p-0.5 text-composer-muted hover:text-composer-foreground"
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
            className="min-h-[4.5rem] resize-none border-0 bg-transparent px-4 pt-3.5 pb-1 text-[15px] text-composer-foreground shadow-none placeholder:text-composer-muted focus-visible:ring-0 dark:bg-transparent"
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
                className="grid size-8 place-items-center rounded-full bg-composer-control text-composer-foreground hover:opacity-80"
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
              <AgentModesMenu
                workspaceId={workspaceId}
                plan={plan}
                billingMock={billingMock}
                llm={llm}
                modelRouting={modelRouting}
                onPlanApplied={onPlanApplied}
                onRoutingApplied={onRoutingApplied}
              />
              <button
                type="button"
                className="grid size-8 place-items-center rounded-full bg-composer-control text-composer-foreground hover:opacity-80"
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
                disabled={busy || disabled || !canSend}
                className="grid size-8 place-items-center rounded-full bg-composer-send text-composer-send-foreground hover:opacity-90 disabled:opacity-35"
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
        </div>

        <div className="mt-4 flex items-center gap-1">
          <button
            type="button"
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Previous categories"
            onClick={() => scrollCategories(-1)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <div
            ref={categoryScroller}
            role="tablist"
            aria-label="Playbook categories"
            className="flex min-w-0 flex-1 items-start justify-between gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {BUILD_PROMPT_CATEGORIES.map((category) => {
              const selected = category.id === categoryId;
              const Icon = CATEGORY_ICONS[category.id];
              return (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  disabled={disabled}
                  onClick={() => selectCategory(category.id)}
                  className={cn(
                    "flex min-w-[4.5rem] flex-1 flex-col items-center gap-1.5 rounded-xl px-1 py-1 text-center text-[11px] text-muted-foreground transition-colors",
                    selected
                      ? "text-foreground"
                      : "hover:text-foreground",
                    disabled && "opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-10 place-items-center rounded-xl border bg-composer-control",
                      selected
                        ? "border-foreground/35 text-foreground"
                        : "border-transparent text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  {category.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Next categories"
            onClick={() => scrollCategories(1)}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="mt-4 px-1">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>Try an example prompt</span>
            <button
              type="button"
              className="grid size-6 place-items-center rounded-full hover:bg-muted hover:text-foreground"
              aria-label="Refresh example prompts"
              onClick={() => setChipSet((index) => nextChipSetIndex(index))}
            >
              <RefreshCw className="size-3" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {exampleChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setChipId(chip.id);
                  if (chip.categoryId) setCategoryId(chip.categoryId);
                  onChange(chip.fill);
                }}
                className={cn(
                  "rounded-full border border-border bg-muted/70 px-3 py-1.5 text-xs text-foreground hover:bg-muted",
                  chipId === chip.id && "border-foreground/30 bg-composer-control",
                  disabled && "opacity-50",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 px-1 text-xs text-muted-foreground">{usageLabel}</p>
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
