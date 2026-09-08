import { after } from "next/server";
import { prisma } from "@/lib/db";
import {
  AGENT_ROLES,
  conversationKeyForAgent,
  displayAgentName,
  playbookHintFromRole,
  type AgentRole,
  type GenerateAction,
} from "@/lib/constants";
import { brandKitBrief, parseBrandKit, type BrandKit } from "@/lib/brand-kit";
import { plannerSystemPrompt } from "@/lib/agent-prompts";
import { generateAgentArtifact } from "@/lib/agents";
import { generateBuilderArtifact } from "@/lib/builders";
import {
  browseNavigate,
  browserInteractGuard,
  crawlLinks,
  excerptFromText,
  formatSnapshot,
  MAX_PAGES_PER_JOB,
} from "@/lib/browse";
import {
  closeBrowserSession,
  sessionClick,
  sessionExtract,
  sessionNavigate,
  sessionScreenshot,
  sessionSnapshot,
  sessionType,
} from "@/lib/browser-session";
import { parseAllowedTools, toolIsAllowed } from "@/lib/companions";
import {
  isClarifyStep,
  isNegativeClarification,
  parseAskKind,
} from "@/lib/job-clarify";
import {
  demoAdAnglesFromUrl,
  demoCompetitorMarkdown,
  demoInboxReplies,
  demoLinkedInPosts,
  demoOutreachFromResearch,
  demoResearchMarkdown,
  demoWhatsAppDrafts,
} from "@/lib/demo";
import { extractUrls, fetchUrlText } from "@/lib/fetch-url";
import {
  formatGmailList,
  gmailCreateDraft,
  gmailListRecent,
} from "@/lib/gmail";
import { resolveLivePosts, resolveRunOutput } from "@/lib/live-output";
import {
  defaultCompetitorUrls,
  ensureAskUser,
  inferPlaybookKey,
  isJobTool,
  linkedinWeekPlaybook,
  parsePlan,
  parsePlaybookJson,
  playbookFromKey,
  resetPlaybook,
} from "@/lib/job-playbooks";
import {
  parseJobContext,
  parseLlmJson,
  serializeJob,
  serializeMessage,
} from "@/lib/job-serialize";
import type {
  BrowsedPage,
  CreateJobResult,
  JobContext,
  JobPlaybook,
  JobStep,
} from "@/lib/job-types";
import { llm, runWithRoutingPreference } from "@/lib/llm";
import { connectedToolNames, getConnectedPlugin } from "@/lib/plugins";
import {
  formatSlackChannels,
  slackListChannels,
  slackPostAllowed,
  slackPostMessage,
} from "@/lib/slack";
import { assertWorkspaceBudget, recordUsage } from "@/lib/usage";
import { tavilySearch } from "@/lib/web-search";
import { ClientError } from "@/lib/http";

const STEP_GAP_MS = 280;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asAgentRole(value: string): AgentRole {
  return AGENT_ROLES.includes(value as AgentRole)
    ? (value as AgentRole)
    : playbookHintFromRole(value);
}

async function appendEvent(input: {
  jobId: string;
  type: string;
  message: string;
  stepId?: string | null;
  data?: Record<string, unknown>;
}) {
  return prisma.jobEvent.create({
    data: {
      jobId: input.jobId,
      type: input.type,
      message: input.message,
      stepId: input.stepId ?? null,
      data: JSON.stringify(input.data ?? {}),
    },
  });
}

async function savePlan(jobId: string, steps: JobStep[]) {
  await prisma.job.update({
    where: { id: jobId },
    data: { plan: JSON.stringify(steps) },
  });
}

async function saveContext(jobId: string, context: JobContext) {
  await prisma.job.update({
    where: { id: jobId },
    data: { context: JSON.stringify(context) },
  });
}

async function loadJob(jobId: string) {
  return prisma.job.findUnique({
    where: { id: jobId },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      artifacts: { orderBy: { createdAt: "asc" } },
    },
  });
}

function assistantIntro(agentName: string, title: string) {
  return `${agentName} started **${title}**. I’ll plan, use tools, and pause when something needs you.`;
}

export async function createJobFromChat(input: {
  workspaceId: string;
  agentId: string;
  message: string;
  playbookKey?: string;
  skillId?: string;
  action?: GenerateAction;
}): Promise<CreateJobResult> {
  await assertWorkspaceBudget(input.workspaceId);
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: input.workspaceId },
  });
  const kit = parseBrandKit(workspace.brandKit);

  const agent = await prisma.agent.findFirst({
    where: {
      id: input.agentId,
      workspaceId: input.workspaceId,
      status: { not: "archived" },
    },
  });
  if (!agent) throw new Error("Choose an agent first.");

  const agentName = displayAgentName(agent.name);
  const hintRole = playbookHintFromRole(agent.role);

  let playbook: JobPlaybook | null = null;
  if (input.skillId) {
    const skill = await prisma.skill.findFirst({
      where: { id: input.skillId, workspaceId: input.workspaceId },
    });
    if (!skill) throw new Error("That skill is not in this workspace.");
    playbook = parsePlaybookJson(skill.playbook);
  }

  const playbookKey =
    input.playbookKey ||
    playbook?.key ||
    inferPlaybookKey(hintRole, input.message, input.action);

  if (!playbook) {
    const gmail = await getConnectedPlugin(input.workspaceId, "gmail");
    playbook = playbookFromKey(playbookKey, hintRole, input.message, kit.website, {
      gmailConnected: Boolean(gmail),
    });
  } else {
    playbook = resetPlaybook(playbook);
  }

  const conversationKey = conversationKeyForAgent(agent.id);
  const conversation = await prisma.conversation.upsert({
    where: {
      workspaceId_agentRole: {
        workspaceId: input.workspaceId,
        agentRole: conversationKey,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      agentId: agent.id,
      agentRole: conversationKey,
    },
    update: { agentId: agent.id },
  });

  const context: JobContext = {
    userUrl: extractUrls(input.message)[0] || kit.website || "",
    competitorUrls: defaultCompetitorUrls(input.message, kit.website),
    pages: [],
    pageCount: 0,
  };

  const job = await prisma.job.create({
    data: {
      workspaceId: input.workspaceId,
      agentId: agent.id,
      agentRole: agent.role || hintRole,
      title: playbook.title,
      prompt: input.message,
      status: "queued",
      plan: JSON.stringify(playbook.steps),
      context: JSON.stringify(context),
      playbookKey: playbook.key,
      skillId: input.skillId || null,
      askPrompt: "",
    },
  });

  const userMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: input.message,
    },
  });
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: assistantIntro(agentName, playbook.title),
    },
  });

  await appendEvent({
    jobId: job.id,
    type: "created",
    message: `${agentName} queued ${playbook.title}.`,
    data: { playbookKey: playbook.key, agentId: agent.id },
  });

  scheduleJobRun(job.id);

  const hydrated = await loadJob(job.id);
  return {
    job: serializeJob(hydrated!),
    messages: [serializeMessage(userMessage), serializeMessage(assistantMessage)],
  };
}

export function scheduleJobRun(jobId: string) {
  after(() => {
    void runJobLoop(jobId);
  });
}

export async function kickQueuedJobs(workspaceId: string) {
  const active = await prisma.job.findMany({
    where: {
      workspaceId,
      status: { in: ["queued", "running"] },
    },
    select: { id: true },
    take: 8,
  });
  for (const job of active) {
    void runJobLoop(job.id);
  }
}

export async function runJobLoop(jobId: string) {
  for (let i = 0; i < 32; i++) {
    const progressed = await tickJob(jobId);
    if (!progressed) break;
    await sleep(STEP_GAP_MS);
  }
}

export async function tickJob(jobId: string): Promise<boolean> {
  const lock = `tick-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const claimed = await prisma.job.updateMany({
    where: {
      id: jobId,
      runnerLock: "",
      status: { in: ["queued", "running"] },
    },
    data: { runnerLock: lock, status: "running" },
  });
  if (claimed.count === 0) return false;

  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.runnerLock !== lock) return false;

    const workspace = await prisma.workspace.findUnique({
      where: { id: job.workspaceId },
    });
    if (!workspace) {
      await failJob(jobId, "Workspace missing.");
      return false;
    }

    const routingPrefer =
      "modelRouting" in workspace
        ? String((workspace as { modelRouting?: string | null }).modelRouting ?? "")
        : "";

    let steps = parsePlan(job.plan);
    if (!steps.length) {
      const agent = job.agentId
        ? await prisma.agent.findUnique({ where: { id: job.agentId } })
        : null;
      steps = await runWithRoutingPreference(routingPrefer, () =>
        planSteps({
          workspaceId: job.workspaceId,
          role: asAgentRole(job.agentRole),
          prompt: job.prompt,
          kit: parseBrandKit(workspace.brandKit),
          agentName: displayAgentName(agent?.name),
          agentInstructions: agent?.instructions || "",
          agentRoleLabel: agent?.role || job.agentRole,
          allowedTools: parseAllowedTools(agent?.allowedTools),
        }),
      );
      await savePlan(jobId, steps);
      await appendEvent({
        jobId,
        type: "plan",
        message: `Plan ready — ${steps.length} steps.`,
        data: { steps: steps.map((step) => step.label) },
      });
      await prisma.job.update({
        where: { id: jobId },
        data: { title: job.title || steps[0]?.label || "Job" },
      });
      return true;
    }

    const pendingPlan = steps.every((step) => step.status === "pending");
    const plannedAlready = await prisma.jobEvent.findFirst({
      where: { jobId, type: "plan" },
    });
    if (pendingPlan && !plannedAlready) {
      await appendEvent({
        jobId,
        type: "plan",
        message: `Plan ready — ${steps.length} steps.`,
        data: { steps: steps.map((step) => step.label) },
      });
      return true;
    }

    const next = steps.find((step) => step.status === "pending");
    if (!next) {
      await closeBrowserSession(jobId);
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "done", runnerLock: "" },
      });
      await appendEvent({
        jobId,
        type: "status",
        message: "Job finished.",
      });
      return false;
    }

    next.status = "running";
    await savePlan(jobId, steps);
    await appendEvent({
      jobId,
      type: "step_start",
      message: next.label,
      stepId: next.id,
      data: { tool: next.tool },
    });

    const kit = parseBrandKit(workspace.brandKit);
    const context = parseJobContext(job.context);
    const agent = job.agentId
      ? await prisma.agent.findUnique({ where: { id: job.agentId } })
      : null;
    const result = await runWithRoutingPreference(routingPrefer, () =>
      executeTool({
        workspaceId: job.workspaceId,
        jobId,
        agentId: job.agentId,
        agentRole: asAgentRole(job.agentRole),
        agentName: displayAgentName(agent?.name),
        agentInstructions: agent?.instructions || "",
        allowedTools: parseAllowedTools(agent?.allowedTools),
        prompt: job.prompt,
        step: next,
        kit,
        context,
      }),
    );

    next.status = result.pause ? "paused" : "done";
    next.result = result.summary;
    await savePlan(jobId, steps);
    await saveContext(jobId, result.context);

    await appendEvent({
      jobId,
      type: result.pause ? "ask_user" : "tool_result",
      message: result.summary,
      stepId: next.id,
      data: {
        tool: next.tool,
        artifactId: result.artifactId,
        url: result.url,
        excerpt: result.excerpt,
      },
    });

    if (result.pause) {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: "needs_you",
          askPrompt: result.askPrompt || next.label,
          askKind: result.askKind || "approve",
          runnerLock: "",
        },
      });
      const conversationKey = job.agentId
        ? conversationKeyForAgent(job.agentId)
        : job.agentRole;
      const conversation = await prisma.conversation.findUnique({
        where: {
          workspaceId_agentRole: {
            workspaceId: job.workspaceId,
            agentRole: conversationKey,
          },
        },
      });
      if (conversation) {
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: "assistant",
            content:
              result.askPrompt ||
              "Drafts are ready. Approve what can leave — I will wait.",
          },
        });
      }
      return false;
    }

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job failed.";
    await failJob(jobId, message);
    return false;
  } finally {
    await prisma.job.updateMany({
      where: { id: jobId, runnerLock: lock, status: "running" },
      data: { runnerLock: "" },
    });
  }
}

async function failJob(jobId: string, message: string) {
  await closeBrowserSession(jobId);
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "failed", error: message, runnerLock: "" },
  });
  await appendEvent({ jobId, type: "error", message });
}

async function planSteps(input: {
  workspaceId: string;
  role: AgentRole;
  prompt: string;
  kit: BrandKit;
  agentName: string;
  agentInstructions: string;
  agentRoleLabel: string;
  allowedTools?: string[];
}): Promise<JobStep[]> {
  const fallback = playbookFromKey(
    inferPlaybookKey(input.role, input.prompt),
    input.role,
    input.prompt,
    input.kit.website,
  ).steps;
  if (!llm.status().configured) return fallback;
  const connected = await connectedToolNames(input.workspaceId);
  try {
    const result = await llm.complete({
      mode: "draft",
      json: true,
      messages: [
        {
          role: "system",
          content: plannerSystemPrompt({
            agentName: input.agentName,
            agentRoleLabel: input.agentRoleLabel,
            role: input.role,
            agentInstructions: input.agentInstructions,
            connectedTools: connected,
            allowedTools: input.allowedTools,
          }),
        },
        {
          role: "user",
          content: `Brand Kit:\n${brandKitBrief(input.kit)}\n\nUser request:\n${input.prompt}`,
        },
      ],
    });
    const json = parseLlmJson(result.text);
    const stepsIn = Array.isArray(json?.steps) ? json.steps : [];
    const steps: JobStep[] = [];
    for (const [index, raw] of stepsIn.entries()) {
      const row = raw as Record<string, unknown>;
      const tool = String(row.tool || "");
      if (!isJobTool(tool)) continue;
      if (input.allowedTools && !toolIsAllowed(input.allowedTools as never, tool)) continue;
      steps.push({
        id: `${tool}-${index}`,
        tool,
        label: String(row.label || tool),
        status: "pending",
        args:
          row.args && typeof row.args === "object"
            ? (row.args as Record<string, unknown>)
            : {},
      });
    }
    if (steps.length >= 2 && steps[0].tool === "read_brand_kit") {
      return ensureAskUser(steps).slice(0, 12);
    }
  } catch {
    // fall through
  }
  return fallback;
}

async function executeTool(input: {
  workspaceId: string;
  jobId: string;
  agentId: string | null;
  agentRole: AgentRole;
  agentName: string;
  agentInstructions: string;
  prompt: string;
  step: JobStep;
  kit: BrandKit;
  context: JobContext;
  allowedTools?: string[];
}): Promise<{
  summary: string;
  context: JobContext;
  pause?: boolean;
  askPrompt?: string;
  askKind?: string;
  artifactId?: string;
  url?: string;
  excerpt?: string;
}> {
  const { step, kit } = input;
  const context = { ...input.context };

  if (input.allowedTools && !toolIsAllowed(input.allowedTools as never, step.tool)) {
    return {
      summary: `${step.tool} is not allowed for this companion.`,
      context,
    };
  }

  if (step.tool === "read_brand_kit") {
    context.brandBrief = brandKitBrief(kit);
    context.website = kit.website || context.userUrl;
    return {
      summary: kit.website
        ? `Read Brand Kit (voice, audience, offer, ${kit.website}).`
        : "Read Brand Kit (voice, audience, offer).",
      context,
    };
  }

  if (step.tool === "fetch_url") {
    const url =
      String(step.args.url || "") ||
      context.userUrl ||
      kit.website ||
      "";
    if (!url) {
      return {
        summary: "No URL in the Brand Kit or message — writing from the kit only.",
        context,
      };
    }
    await appendEvent({
      jobId: input.jobId,
      type: "tool_call",
      message: `fetch_url ${url}`,
      stepId: step.id,
      data: { tool: "fetch_url", url },
    });
    const fetched = await fetchUrlText(url);
    const fetchedPage = toBrowsedPage({
      url: fetched.url,
      ok: fetched.ok,
      text: fetched.text,
      excerpt: excerptFromText(fetched.text),
      links: fetched.links,
      engine: "fetch",
      error: fetched.error,
    });
    rememberPage(context, fetchedPage);
    return {
      summary: fetched.ok
        ? `Fetched ${fetched.url} (${fetched.text.length} chars).`
        : `Could not fully fetch ${url}${fetched.error ? ` — ${fetched.error}` : ""}. Will write from what we have.`,
      context,
      url: fetchedPage.url,
      excerpt: fetchedPage.excerpt,
    };
  }

  if (step.tool === "browser_navigate") {
    const url =
      String(step.args.url || "") ||
      context.userUrl ||
      kit.website ||
      "";
    if (!url) {
      return {
        summary: "No URL to open — writing from the Brand Kit only.",
        context,
      };
    }
    if ((context.pageCount ?? 0) >= MAX_PAGES_PER_JOB) {
      return {
        summary: `Browse cap reached (${MAX_PAGES_PER_JOB} pages). Skipping ${url}.`,
        context,
        url,
      };
    }
    await appendEvent({
      jobId: input.jobId,
      type: "tool_call",
      message: `browser_navigate ${url}`,
      stepId: step.id,
      data: { tool: "browser_navigate", url },
    });
    try {
      const live = await sessionNavigate(input.jobId, url);
      if (live.ok && live.page) {
        const page = toBrowsedPage(live.page);
        rememberPage(context, page);
        context.browserMode = live.mode;
        return {
          summary: `browser_navigate ${page.url} (${page.engine} session)`,
          context,
          url: page.url,
          excerpt: page.excerpt,
        };
      }
      const page = toBrowsedPage(await browseNavigate(url));
      rememberPage(context, page);
      context.browserMode = page.engine || "fetch";
      const sessionNote = live.error ? ` Live tab: ${live.error}` : "";
      return {
        summary: page.ok
          ? `browser_navigate ${page.url} (${page.engine})${sessionNote}`
          : `browser_navigate ${page.url} — partial${page.error ? ` (${page.error})` : ""}`,
        context,
        url: page.url,
        excerpt: page.excerpt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Navigate failed";
      return {
        summary: `Could not open ${url} — ${message}`,
        context,
        url,
      };
    }
  }

  if (step.tool === "browser_snapshot") {
    const live = await sessionSnapshot(input.jobId);
    if (live.ok && live.page) {
      const page = toBrowsedPage(live.page);
      context.currentPage = page;
      context.snapshot = formatSnapshot(page);
      await appendEvent({
        jobId: input.jobId,
        type: "tool_call",
        message: `browser_snapshot ${page.url}`,
        stepId: step.id,
        data: { tool: "browser_snapshot", url: page.url, excerpt: page.excerpt },
      });
      return {
        summary: `browser_snapshot ${page.url} (live tab)`,
        context,
        url: page.url,
        excerpt: page.excerpt,
      };
    }
    const page = context.currentPage || context.pages?.at(-1);
    context.snapshot = formatSnapshot(page);
    await appendEvent({
      jobId: input.jobId,
      type: "tool_call",
      message: page ? `browser_snapshot ${page.url}` : "browser_snapshot (no page)",
      stepId: step.id,
      data: {
        tool: "browser_snapshot",
        url: page?.url,
        excerpt: page?.excerpt,
      },
    });
    return {
      summary: page
        ? `browser_snapshot ${page.url}`
        : "No page loaded yet — snapshot is empty.",
      context,
      url: page?.url,
      excerpt: page?.excerpt,
    };
  }

  if (step.tool === "crawl_links") {
    const start = context.currentPage || context.pages?.at(-1);
    if (!start) {
      return { summary: "No page to crawl from.", context };
    }
    const remaining = Math.max(0, MAX_PAGES_PER_JOB - (context.pageCount ?? 0));
    const want = Math.min(Number(step.args.maxPages || 2), remaining);
    if (want <= 0) {
      return {
        summary: `Browse cap reached (${MAX_PAGES_PER_JOB} pages). Crawl skipped.`,
        context,
        url: start.url,
      };
    }
    const visited = new Set((context.pages || []).map((page) => page.url));
    visited.add(start.url);
    const extra = await crawlLinks(
      {
        url: start.url,
        ok: start.ok,
        title: start.title,
        text: start.text,
        excerpt: start.excerpt,
        links: start.links || [],
        engine: (start.engine as "playwright" | "fetch") || "fetch",
        error: start.error,
      },
      {
        depth: Number(step.args.depth || 1),
        maxPages: want,
        alreadyVisited: visited,
      },
    );
    for (const raw of extra) {
      const page = toBrowsedPage(raw);
      rememberPage(context, page);
      await appendEvent({
        jobId: input.jobId,
        type: "tool_call",
        message: `crawl_links ${page.url}`,
        stepId: step.id,
        data: { tool: "crawl_links", url: page.url, excerpt: page.excerpt },
      });
    }
    const last = extra.at(-1);
    return {
      summary: extra.length
        ? `Crawled ${extra.length} public link${extra.length === 1 ? "" : "s"} from ${start.url}.`
        : `No extra public links to follow from ${start.url}.`,
      context,
      url: last?.url || start.url,
      excerpt: last ? excerptFromText(last.text) : start.excerpt,
    };
  }

  if (step.tool === "browser_click" || step.tool === "browser_type") {
    const guard = browserInteractGuard(step.tool, step.args);
    if (!guard.ok) {
      return { summary: guard.reason, context };
    }
    await appendEvent({
      jobId: input.jobId,
      type: "tool_call",
      message: `${step.tool} ${String(step.args.selector || step.args.text || "")}`.trim(),
      stepId: step.id,
      data: { tool: step.tool },
    });
    const live =
      step.tool === "browser_click"
        ? await sessionClick(input.jobId, step.args)
        : await sessionType(input.jobId, step.args);
    if (live.page) {
      const page = toBrowsedPage(live.page);
      rememberPage(context, page, { count: false });
    }
    return {
      summary: live.ok
        ? `${step.tool} on live tab (${live.mode})`
        : `${step.tool} did not run — ${live.error || live.mode}`,
      context,
      url: live.page?.url,
      excerpt: live.excerpt,
    };
  }

  if (step.tool === "browser_extract") {
    await appendEvent({
      jobId: input.jobId,
      type: "tool_call",
      message: "browser_extract",
      stepId: step.id,
      data: { tool: "browser_extract" },
    });
    const live = await sessionExtract(input.jobId, step.args);
    if (live.extracted) context.extracted = live.extracted;
    if (live.page) {
      const page = toBrowsedPage(live.page);
      rememberPage(context, page, { count: false });
      if (!context.extracted) context.extracted = page.text;
    } else if (!live.ok && context.currentPage) {
      context.extracted = context.currentPage.text;
      return {
        summary: `browser_extract used last fetched page — ${live.error || live.mode}`,
        context,
        url: context.currentPage.url,
        excerpt: context.currentPage.excerpt,
      };
    }
    return {
      summary: live.ok
        ? `browser_extract (${(live.extracted || "").length} chars)`
        : `browser_extract did not run — ${live.error || live.mode}`,
      context,
      url: live.page?.url,
      excerpt: live.excerpt,
    };
  }

  if (step.tool === "browser_screenshot") {
    await appendEvent({
      jobId: input.jobId,
      type: "tool_call",
      message: "browser_screenshot",
      stepId: step.id,
      data: { tool: "browser_screenshot" },
    });
    const live = await sessionScreenshot(input.jobId);
    if (live.screenshot) context.screenshot = live.screenshot;
    if (live.page) rememberPage(context, toBrowsedPage(live.page), { count: false });
    return {
      summary: live.ok
        ? live.screenshot
          ? "browser_screenshot captured"
          : live.error || "browser_screenshot captured"
        : `browser_screenshot did not run — ${live.error || live.mode}`,
      context,
      url: live.page?.url,
      excerpt: live.excerpt,
    };
  }

  if (step.tool === "read_artifact") {
    const types = Array.isArray(step.args.types)
      ? (step.args.types as string[])
      : ["research_pack", "competitor_scan"];
    const artifact = await prisma.artifact.findFirst({
      where: {
        workspaceId: input.workspaceId,
        type: { in: types },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!artifact) {
      return {
        summary: "No research artifact on this desk yet — writing from the Brand Kit only.",
        context,
      };
    }
    context.priorArtifact = {
      id: artifact.id,
      title: artifact.title,
      type: artifact.type,
      content: artifact.content.slice(0, 12_000),
    };
    return {
      summary: `Read artifact “${artifact.title}” (${artifact.type}).`,
      context,
    };
  }

  if (step.tool === "web_search") {
    const query =
      String(step.args.query || "").trim() ||
      input.prompt.trim() ||
      "";
    const connected = await getConnectedPlugin(input.workspaceId, "web-search");
    if (!connected) {
      throw new Error(
        "Web Search is not connected. Open Marketplace → Plugins and Connect with a Tavily API key (or documented TAVILY_API_KEY).",
      );
    }
    await appendEvent({
      jobId: input.jobId,
      type: "tool_call",
      message: `web_search ${query.slice(0, 80)}`,
      stepId: step.id,
    });
    const searched = await tavilySearch({ apiKey: connected.secret, query });
    context.search = {
      query: searched.query,
      ok: searched.ok,
      text: searched.text,
    };
    if (!searched.ok) {
      throw new Error(searched.error || "Web search returned nothing.");
    }
    return {
      summary: `Searched the web for “${searched.query}” (${searched.text.length} chars).`,
      context,
    };
  }

  if (step.tool === "gmail_list_recent") {
    await appendEvent({
      jobId: input.jobId,
      type: "tool_call",
      message: "gmail_list_recent",
      stepId: step.id,
      data: { tool: "gmail_list_recent" },
    });
    const messages = await gmailListRecent({
      workspaceId: input.workspaceId,
      max: Number(step.args.max || 8),
      query: String(step.args.query || step.args.q || "").trim() || undefined,
    });
    context.gmailMessages = messages;
    return {
      summary: messages.length
        ? `gmail_list_recent — ${messages.length} message${messages.length === 1 ? "" : "s"}`
        : "gmail_list_recent — inbox empty",
      context,
      excerpt: formatGmailList(messages).slice(0, 280),
    };
  }

  if (step.tool === "gmail_create_draft") {
    const to =
      String(step.args.to || "").trim() ||
      extractEmail(input.prompt) ||
      "";
    const subject =
      String(step.args.subject || "").trim() ||
      `Note from ${input.agentName}`;
    const body =
      String(step.args.body || "").trim() ||
      input.prompt.trim() ||
      "Draft from CINEM Pro. Not sent.";
    await appendEvent({
      jobId: input.jobId,
      type: "tool_call",
      message: `gmail_create_draft to ${to || "(missing)"}`,
      stepId: step.id,
      data: { tool: "gmail_create_draft", to },
    });
    const draft = await gmailCreateDraft({
      workspaceId: input.workspaceId,
      to,
      subject,
      body,
    });
    context.gmailDraft = draft;
    return {
      summary: `gmail_create_draft ${draft.id} to ${draft.to} (not sent)`,
      context,
    };
  }

  if (step.tool === "slack_list_channels") {
    await appendEvent({
      jobId: input.jobId,
      type: "tool_call",
      message: "slack_list_channels",
      stepId: step.id,
      data: { tool: "slack_list_channels" },
    });
    const channels = await slackListChannels(input.workspaceId);
    context.slackChannels = channels;
    return {
      summary: channels.length
        ? `slack_list_channels — ${channels.length} channel${channels.length === 1 ? "" : "s"}`
        : "slack_list_channels — none visible",
      context,
      excerpt: formatSlackChannels(channels).slice(0, 280),
    };
  }

  if (step.tool === "slack_draft_message") {
    const channelArg = String(step.args.channel || "").trim();
    const named = context.slackChannels?.find(
      (channel) =>
        channel.id === channelArg ||
        channel.name === channelArg.replace(/^#/, ""),
    );
    const picked = named || context.slackChannels?.[0];
    const channel = picked?.id || channelArg;
    const channelName = picked?.name || channelArg;
    const text =
      String(step.args.text || "").trim() ||
      input.prompt.trim() ||
      "";
    if (!channel || !text) {
      throw new Error("slack_draft_message needs a channel and message text.");
    }
    context.slackDraft = { channel, channelName, text };
    const written = await writeJobArtifact(
      { ...input, step: { ...step, args: { ...step.args, kind: "slack_draft" } } },
      context,
    );
    return {
      summary: `Drafted Slack message for #${channelName} (not posted)`,
      context: written.context,
      artifactId: written.id,
    };
  }

  if (step.tool === "slack_post_message") {
    const job = await prisma.job.findUnique({ where: { id: input.jobId } });
    const plan = parsePlan(job?.plan || []);
    if (!slackPostAllowed(plan, step.id)) {
      throw new Error(
        "Refused: slack_post_message requires a completed ask_user approval step first.",
      );
    }
    const draft = context.slackDraft;
    const channel = String(step.args.channel || draft?.channel || "").trim();
    const text = String(step.args.text || draft?.text || "").trim();
    await appendEvent({
      jobId: input.jobId,
      type: "tool_call",
      message: `slack_post_message ${channel}`,
      stepId: step.id,
      data: { tool: "slack_post_message", channel },
    });
    const posted = await slackPostMessage({
      workspaceId: input.workspaceId,
      channel,
      text,
    });
    return {
      summary: `Posted to Slack ${posted.channel} (ts ${posted.ts})`,
      context,
    };
  }

  if (step.tool === "write_artifact") {
    const written = await writeJobArtifact(input, context);
    return {
      summary: `Wrote artifact: ${written.title}`,
      context: written.context,
      artifactId: written.id,
    };
  }

  if (step.tool === "ask_user") {
    const prompt =
      String(step.args.prompt || "") ||
      "Approve the drafts before they leave the desk.";
    const kind = parseAskKind(step.args);
    return {
      summary: prompt,
      context,
      pause: true,
      askPrompt: prompt,
      askKind: kind,
    };
  }

  return { summary: `Unknown tool ${step.tool}`, context };
}

function toBrowsedPage(page: {
  url: string;
  ok: boolean;
  title?: string;
  text: string;
  excerpt?: string;
  links?: string[];
  engine?: string;
  error?: string;
}): BrowsedPage {
  return {
    url: page.url,
    ok: page.ok,
    title: page.title,
    text: page.text,
    excerpt: page.excerpt || excerptFromText(page.text),
    links: page.links,
    engine: page.engine,
    error: page.error,
  };
}

function rememberPage(context: JobContext, page: BrowsedPage, opts?: { count?: boolean }) {
  const count = opts?.count !== false;
  if (count) {
    context.pages = [...(context.pages || []), page];
    context.pageCount = (context.pageCount || 0) + 1;
  } else if (context.pages?.length) {
    context.pages = [...context.pages.slice(0, -1), page];
  } else {
    context.pages = [page];
  }
  context.currentPage = page;
  context.fetched = { url: page.url, ok: page.ok, text: page.text };
}

function extractEmail(text: string) {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] || "";
}

async function writeJobArtifact(
  input: {
    workspaceId: string;
    jobId: string;
    agentId: string | null;
    agentRole: AgentRole;
    agentName: string;
    agentInstructions: string;
    prompt: string;
    step: JobStep;
    kit: BrandKit;
  },
  context: JobContext,
): Promise<{ id: string; title: string; context: JobContext }> {
  const kind = String(input.step.args.kind || "generic");
  const index = Number(input.step.args.index || 0);
  let title = String(input.step.args.title || input.step.label);
  let content = "";
  let type = kind;
  let model = "demo";
  let provider = "demo";
  let tokens = 0;
  const live = llm.status().configured;

  if (kind === "linkedin_post") {
    if (!context.weekPosts?.length) {
      const generated = await generateLinkedInPosts({
        kit: input.kit,
        prompt: input.prompt,
        agentName: input.agentName,
        agentInstructions: input.agentInstructions,
        context,
      });
      context.weekPosts = generated.posts;
      tokens += generated.tokens;
      model = generated.model;
      provider = generated.provider;
    }
    const post = context.weekPosts[Math.max(0, index - 1)] || context.weekPosts[0];
    title = post?.title || `LinkedIn post ${index || 1}`;
    content = `# ${title}\n\n${post?.body || ""}`;
    type = "linkedin_post";
  } else if (kind === "research_pack") {
    const pack = await generateResearchPack({
      kit: input.kit,
      prompt: input.prompt,
      context,
      agentName: input.agentName,
      agentInstructions: input.agentInstructions,
    });
    title = pack.title;
    content = pack.content;
    type = "research_pack";
    model = pack.model;
    provider = pack.provider;
    tokens = pack.tokens;
  } else if (kind === "competitor_scan") {
    const pack = await generateCompetitorScan({
      kit: input.kit,
      prompt: input.prompt,
      context,
      agentName: input.agentName,
      agentInstructions: input.agentInstructions,
    });
    title = pack.title;
    content = pack.content;
    type = "competitor_scan";
    model = pack.model;
    provider = pack.provider;
    tokens = pack.tokens;
  } else if (kind === "outreach_pack") {
    const pack = await generateOutreachPack({
      kit: input.kit,
      prompt: input.prompt,
      context,
      agentName: input.agentName,
      agentInstructions: input.agentInstructions,
    });
    title = pack.title;
    content = pack.content;
    type = "outreach_pack";
    model = pack.model;
    provider = pack.provider;
    tokens = pack.tokens;
  } else if (kind === "ad_angles") {
    const pack = await generateAdAngles({
      kit: input.kit,
      prompt: input.prompt,
      context,
      agentName: input.agentName,
      agentInstructions: input.agentInstructions,
    });
    title = pack.title;
    content = pack.content;
    type = "ad_angles";
    model = pack.model;
    provider = pack.provider;
    tokens = pack.tokens;
  } else if (kind === "inbox_replies") {
    const pack = await generateInboxReplies({
      kit: input.kit,
      prompt: input.prompt,
      context,
      agentName: input.agentName,
      agentInstructions: input.agentInstructions,
    });
    title = pack.title;
    content = pack.content;
    type = "inbox_replies";
    model = pack.model;
    provider = pack.provider;
    tokens = pack.tokens;
  } else if (kind === "whatsapp_drafts") {
    const pack = await generateWhatsAppDrafts({
      kit: input.kit,
      prompt: input.prompt,
      context,
      agentName: input.agentName,
      agentInstructions: input.agentInstructions,
    });
    title = pack.title;
    content = pack.content;
    type = "whatsapp_drafts";
    model = pack.model;
    provider = pack.provider;
    tokens = pack.tokens;
  } else if (kind === "gmail_inbox") {
    title = "Recent Gmail";
    content = `# Recent Gmail\n\n${formatGmailList(context.gmailMessages || [])}\n`;
    type = "gmail_inbox";
    model = "gmail";
    provider = "gmail";
  } else if (kind === "inbox_invoices") {
    const listed = formatGmailList(context.gmailMessages || []);
    const connected = Boolean(context.gmailMessages);
    title = "Inbox invoices";
    content = `# Inbox invoice finder

${
  connected || (context.gmailMessages && context.gmailMessages.length)
    ? listed
    : "Gmail is not connected on this workspace. Connect Gmail in Marketplace → Plugins (real OAuth). This list is empty on purpose — not a fake inbox."
}

## QuickBooks

TODO: QuickBooks write is not wired in this slice. CINEM Pro listed mail only. Export this list and enter bills in QuickBooks yourself.
`;
    type = "inbox_invoices";
    model = connected ? "gmail" : "demo";
    provider = connected ? "gmail" : "demo";
  } else if (kind === "recruiter_sheet") {
    const pack = await generateRecruiterSheet({
      kit: input.kit,
      prompt: input.prompt,
      context,
      agentName: input.agentName,
      agentInstructions: input.agentInstructions,
    });
    title = pack.title;
    content = pack.content;
    type = "recruiter_sheet";
    model = pack.model;
    provider = pack.provider;
    tokens = pack.tokens;
  } else if (kind === "gmail_draft") {
    const draft = context.gmailDraft;
    title = draft ? `Gmail draft to ${draft.to}` : "Gmail draft";
    content = `# Gmail draft (not sent)\n\n${
      draft
        ? `Draft id: ${draft.id}\nTo: ${draft.to}\nSubject: ${draft.subject}\n`
        : "No draft id captured."
    }\nRequest:\n${input.prompt}\n`;
    type = "gmail_draft";
    model = "gmail";
    provider = "gmail";
  } else if (kind === "slack_channels") {
    title = "Slack channels";
    content = `# Slack channels\n\n${formatSlackChannels(context.slackChannels || [])}\n`;
    type = "slack_channels";
    model = "slack";
    provider = "slack";
  } else if (kind === "website" || kind === "app" || kind === "deck") {
    const pack = await generateBuilderArtifact({
      kind: kind === "app" ? "app" : kind === "deck" ? "deck" : "website",
      kit: input.kit,
      prompt: pageAwarePrompt(input.prompt, context),
      agentName: input.agentName,
      agentInstructions: input.agentInstructions,
    });
    title = pack.title;
    content = pack.content;
    type = pack.type;
    model = pack.model;
    provider = pack.provider;
    tokens = pack.tokens;
    if (live && pack.demo) {
      throw new Error("Live job refused to persist a demo template.");
    }
  } else if (kind === "slack_draft") {
    const draft = context.slackDraft;
    title = draft ? `Slack draft for #${draft.channelName || draft.channel}` : "Slack draft";
    content = `# Slack draft (not posted)\n\nChannel: ${draft?.channelName || draft?.channel || "(none)"}\nId: ${draft?.channel || ""}\n\n${draft?.text || ""}\n`;
    type = "slack_draft";
    model = "slack";
    provider = "slack";
  } else {
    const generated = await generateAgentArtifact({
      role: input.agentRole,
      kit: input.kit,
      userMessage: pageAwarePrompt(input.prompt, context),
      history: [],
      action:
        kind === "sales_pack"
          ? "sales_pack"
          : kind === "linkedin_week"
            ? "generate_week"
            : kind === "brand_kit_draft"
              ? "brand_kit_draft"
              : "default",
      agentName: input.agentName,
      agentInstructions: input.agentInstructions,
    });
    title = generated.artifact.title;
    content = generated.artifact.content;
    type = generated.artifact.type;
    model = generated.model;
    provider = generated.provider;
    tokens = generated.tokens;
    if (live && generated.demo) {
      throw new Error("Live job refused to persist a demo template.");
    }
  }

  const conversationKey = input.agentId
    ? conversationKeyForAgent(input.agentId)
    : input.agentRole;
  const conversation = await prisma.conversation.upsert({
    where: {
      workspaceId_agentRole: {
        workspaceId: input.workspaceId,
        agentRole: conversationKey,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      agentRole: conversationKey,
    },
    update: { agentId: input.agentId },
  });

  const artifact = await prisma.artifact.create({
    data: {
      workspaceId: input.workspaceId,
      conversationId: conversation.id,
      jobId: input.jobId,
      agentId: input.agentId,
      agentRole: input.agentRole,
      type,
      title,
      content,
      status: "draft",
      model,
      provider,
    },
  });

  await recordUsage({
    workspaceId: input.workspaceId,
    tokens: Math.max(tokens || (provider === "demo" ? 80 : 1), 1),
    model,
    agentRole: input.agentRole,
    agentId: input.agentId,
  });

  return { id: artifact.id, title, context };
}

function pageContextBlock(context?: JobContext): string {
  if (!context) return "Pages: (none)";
  const pages = context.pages?.length
    ? context.pages
        .map(
          (page) =>
            `- ${page.url} [${page.engine || "fetch"}${page.ok ? "" : ", partial"}]\n${(page.excerpt || page.text).slice(0, 800)}`,
        )
        .join("\n\n")
    : context.fetched
      ? `${context.fetched.url}\n${context.fetched.text.slice(0, 1200)}`
      : "(none)";
  const snap = context.snapshot ? `\n\nSnapshot:\n${context.snapshot.slice(0, 2000)}` : "";
  const extracted = context.extracted
    ? `\n\nExtracted:\n${context.extracted.slice(0, 4000)}`
    : "";
  const answer = context.userAnswer ? `\n\nUser answered: ${context.userAnswer}` : "";
  const search = context.search?.text
    ? `\n\nWeb search for “${context.search.query}”:\n${context.search.text.slice(0, 4000)}`
    : "";
  return `Pages:\n${pages}${snap}${extracted}${answer}${search}`;
}

function pageAwarePrompt(prompt: string, context: JobContext): string {
  const block = pageContextBlock(context);
  if (block.includes("(none)") && !context.priorArtifact && !context.search?.text) {
    return prompt;
  }
  return `${prompt}\n\n${block}${
    context.priorArtifact
      ? `\n\nPrior artifact ${context.priorArtifact.title}:\n${context.priorArtifact.content.slice(0, 2000)}`
      : ""
  }`;
}

async function generateLinkedInPosts(input: {
  kit: BrandKit;
  prompt: string;
  agentName: string;
  agentInstructions: string;
  context?: JobContext;
}): Promise<{
  posts: { title: string; body: string }[];
  tokens: number;
  model: string;
  provider: string;
}> {
  const demoPosts = demoLinkedInPosts(input.kit);
  const live = llm.status().configured;
  if (!live) {
    return { posts: demoPosts, tokens: 0, model: "demo", provider: "demo" };
  }
  const result = await llm.complete({
    mode: "draft",
    kind: "posts",
    json: true,
    messages: [
      {
        role: "system",
        content: `You are ${input.agentName} on CINEM Pro.
${input.agentInstructions}
Write LinkedIn posts in Brand Kit voice. No forbidden words. Do not claim they were published.
If page text is provided, ground the posts in it.
Return JSON: { "posts": [{ "title": string, "body": string }] }`,
      },
      {
        role: "user",
        content: `Brand Kit:\n${brandKitBrief(input.kit)}\n\n${pageContextBlock(input.context)}\n\nRequest:\n${input.prompt}`,
      },
    ],
  });
  const json = parseLlmJson(result.text);
  const posts = Array.isArray(json?.posts)
    ? (json.posts as { title?: string; body?: string }[])
        .map((post) => ({
          title: String(post.title || "").trim(),
          body: String(post.body || "").trim(),
        }))
        .filter((post) => post.title && post.body)
    : [];
  return {
    posts: resolveLivePosts({ live: true, posts, demoPosts }),
    tokens: result.tokens,
    model: result.model,
    provider: result.provider,
  };
}

type ArtifactPack = {
  title: string;
  content: string;
  tokens: number;
  model: string;
  provider: string;
};

async function generateResearchPack(input: {
  kit: BrandKit;
  prompt: string;
  context: JobContext;
  agentName: string;
  agentInstructions: string;
}): Promise<ArtifactPack> {
  const fetched = input.context.fetched;
  const live = llm.status().configured;
  const demoContent = demoResearchMarkdown(input.kit, fetched);
  if (!live) {
    const resolved = resolveRunOutput({
      live: false,
      fetched,
      pages: input.context.pages,
      demoTitle: "Company research notes",
      demoContent,
    });
    return {
      title: resolved.title,
      content: resolved.content,
      tokens: 0,
      model: "demo",
      provider: "demo",
    };
  }
  let llmTitle = "";
  let llmContent = "";
  let tokens = 0;
  let model = "live";
  let provider = "live";
  try {
    const result = await llm.complete({
      mode: "draft",
      json: true,
      messages: [
        {
          role: "system",
          content: `You are ${input.agentName} on CINEM Pro.
${input.agentInstructions}
Write sourced notes. Do not invent quotes or numbers.
Return JSON: { "title": string, "content": string } Markdown with Source, What the page says, Implications, What not to copy.`,
        },
        {
          role: "user",
          content: `Brand Kit:\n${brandKitBrief(input.kit)}\n\n${pageContextBlock(input.context)}\n\nRequest:\n${input.prompt}`,
        },
      ],
    });
    const json = parseLlmJson(result.text);
    llmTitle = String(json?.title || "").trim();
    llmContent = String(json?.content || "").trim();
    tokens = result.tokens;
    model = result.model;
    provider = result.provider;
  } catch {
    // Live path may still persist browsed page text — never canned demo copy.
  }
  const resolved = resolveRunOutput({
    live: true,
    llmTitle,
    llmContent,
    fetched,
    pages: input.context.pages,
    search: input.context.search,
    demoTitle: "Company research notes",
    demoContent,
  });
  return {
    title: resolved.title,
    content: resolved.content,
    tokens,
    model: resolved.source === "tools" ? "browse" : model,
    provider: resolved.source === "tools" ? "tools" : provider,
  };
}

async function generateCompetitorScan(input: {
  kit: BrandKit;
  prompt: string;
  context: JobContext;
  agentName: string;
  agentInstructions: string;
}): Promise<ArtifactPack> {
  const demoContent = demoCompetitorMarkdown(input.kit, input.context.pages);
  const live = llm.status().configured;
  if (!live) {
    const resolved = resolveRunOutput({
      live: false,
      pages: input.context.pages,
      fetched: input.context.fetched,
      demoTitle: "Competitor scan",
      demoContent,
    });
    return {
      title: resolved.title,
      content: resolved.content,
      tokens: 0,
      model: "demo",
      provider: "demo",
    };
  }
  let llmTitle = "";
  let llmContent = "";
  let tokens = 0;
  let model = "live";
  let provider = "live";
  try {
    const result = await llm.complete({
      mode: "draft",
      json: true,
      messages: [
        {
          role: "system",
          content: `You are ${input.agentName} on CINEM Pro.
${input.agentInstructions}
Write a competitor comparison from browsed pages only. No invented quotes.
Return JSON: { "title": string, "content": string } Markdown with one section per URL plus Comparison and What not to copy.`,
        },
        {
          role: "user",
          content: `Brand Kit:\n${brandKitBrief(input.kit)}\n\n${pageContextBlock(input.context)}\n\nRequest:\n${input.prompt}`,
        },
      ],
    });
    const json = parseLlmJson(result.text);
    llmTitle = String(json?.title || "").trim();
    llmContent = String(json?.content || "").trim();
    tokens = result.tokens;
    model = result.model;
    provider = result.provider;
  } catch {
    // Live path may still persist browsed page text — never canned demo copy.
  }
  const resolved = resolveRunOutput({
    live: true,
    llmTitle,
    llmContent,
    pages: input.context.pages,
    fetched: input.context.fetched,
    demoTitle: "Competitor scan",
    demoContent,
  });
  return {
    title: resolved.title,
    content: resolved.content,
    tokens,
    model: resolved.source === "tools" ? "browse" : model,
    provider: resolved.source === "tools" ? "tools" : provider,
  };
}

async function generateOutreachPack(input: {
  kit: BrandKit;
  prompt: string;
  context: JobContext;
  agentName: string;
  agentInstructions: string;
}): Promise<ArtifactPack> {
  const fallback = demoOutreachFromResearch(input.kit, input.context.priorArtifact);
  const live = llm.status().configured;
  if (!live) {
    return {
      title: fallback.title,
      content: fallback.content,
      tokens: 0,
      model: "demo",
      provider: "demo",
    };
  }
  let llmTitle = "";
  let llmContent = "";
  let tokens = 0;
  let model = "live";
  let provider = "live";
  try {
    const result = await llm.complete({
      mode: "draft",
      json: true,
      messages: [
        {
          role: "system",
          content: `You are ${input.agentName} on CINEM Pro.
${input.agentInstructions}
Write exactly 5 LinkedIn DMs. Do not send. Ground them in the research artifact and/or browsed page text when present.
Return JSON: { "title": string, "content": string } Markdown with ## LinkedIn DM 1 … 5.`,
        },
        {
          role: "user",
          content: `Brand Kit:\n${brandKitBrief(input.kit)}\n\n${pageContextBlock(input.context)}\n\nResearch artifact:\n${
            input.context.priorArtifact
              ? `${input.context.priorArtifact.title}\n${input.context.priorArtifact.content}`
              : "(none)"
          }\n\nRequest:\n${input.prompt}`,
        },
      ],
    });
    const json = parseLlmJson(result.text);
    llmTitle = String(json?.title || "").trim();
    llmContent = String(json?.content || "").trim();
    tokens = result.tokens;
    model = result.model;
    provider = result.provider;
  } catch {
    // Live path: never persist demo outreach when keys exist.
  }
  const resolved = resolveRunOutput({
    live: true,
    llmTitle,
    llmContent,
    demoTitle: fallback.title,
    demoContent: fallback.content,
  });
  return {
    title: resolved.title,
    content: resolved.content,
    tokens,
    model,
    provider,
  };
}

async function generateAdAngles(input: {
  kit: BrandKit;
  prompt: string;
  context: JobContext;
  agentName: string;
  agentInstructions: string;
}): Promise<ArtifactPack> {
  const fallback = demoAdAnglesFromUrl(input.kit, input.context.fetched);
  const live = llm.status().configured;
  if (!live) {
    const resolved = resolveRunOutput({
      live: false,
      pages: input.context.pages,
      fetched: input.context.fetched,
      demoTitle: fallback.title,
      demoContent: fallback.content,
    });
    return {
      title: resolved.title,
      content: resolved.content,
      tokens: 0,
      model: "demo",
      provider: "demo",
    };
  }
  let llmTitle = "";
  let llmContent = "";
  let tokens = 0;
  let model = "live";
  let provider = "live";
  try {
    const result = await llm.complete({
      mode: "draft",
      json: true,
      messages: [
        {
          role: "system",
          content: `You are ${input.agentName} on CINEM Pro.
${input.agentInstructions}
Write 5 ad angles with primary text from the landing page. Creative only — no media buy.
Return JSON: { "title": string, "content": string }.`,
        },
        {
          role: "user",
          content: `Brand Kit:\n${brandKitBrief(input.kit)}\n\n${pageContextBlock(input.context)}\n\nRequest:\n${input.prompt}`,
        },
      ],
    });
    const json = parseLlmJson(result.text);
    llmTitle = String(json?.title || "").trim();
    llmContent = String(json?.content || "").trim();
    tokens = result.tokens;
    model = result.model;
    provider = result.provider;
  } catch {
    // Live path may still persist browsed page text — never canned demo copy.
  }
  const resolved = resolveRunOutput({
    live: true,
    llmTitle,
    llmContent,
    pages: input.context.pages,
    fetched: input.context.fetched,
    demoTitle: fallback.title,
    demoContent: fallback.content,
  });
  return {
    title: resolved.title,
    content: resolved.content,
    tokens,
    model: resolved.source === "tools" ? "browse" : model,
    provider: resolved.source === "tools" ? "tools" : provider,
  };
}

async function generateInboxReplies(input: {
  kit: BrandKit;
  prompt: string;
  context: JobContext;
  agentName: string;
  agentInstructions: string;
}): Promise<ArtifactPack> {
  const fallback = demoInboxReplies(input.kit, input.context.gmailMessages);
  const live = llm.status().configured;
  const inboxNote = input.context.gmailMessages?.length
    ? formatGmailList(input.context.gmailMessages)
    : "Gmail is not connected. Draft from the Brand Kit and the user brief only.";
  if (!live) {
    return {
      title: fallback.title,
      content: fallback.content,
      tokens: 0,
      model: "demo",
      provider: "demo",
    };
  }
  const result = await llm.complete({
    mode: "draft",
    json: true,
    messages: [
      {
        role: "system",
        content: `You are ${input.agentName} on CINEM Pro.
${input.agentInstructions}
Draft short email replies. Never claim they were sent. Last line must say CINEM Pro did not send.
Return JSON: { "title": string, "content": string }.`,
      },
      {
        role: "user",
        content: `Brand Kit:\n${brandKitBrief(input.kit)}\n\nInbox:\n${inboxNote}\n\nRequest:\n${input.prompt}`,
      },
    ],
  });
  const json = parseLlmJson(result.text);
  const title = String(json?.title || "").trim() || fallback.title;
  const content = String(json?.content || "").trim() || fallback.content;
  return {
    title,
    content,
    tokens: result.tokens,
    model: result.model,
    provider: result.provider,
  };
}

async function generateRecruiterSheet(input: {
  kit: BrandKit;
  prompt: string;
  context: JobContext;
  agentName: string;
  agentInstructions: string;
}): Promise<ArtifactPack> {
  const extracted =
    input.context.extracted ||
    input.context.currentPage?.text ||
    input.context.pages?.at(-1)?.text ||
    "";
  const fallback = {
    title: "Recruiter sheet (public page)",
    content: `# Recruiter sheet

CINEM Pro did not email anyone.

${extracted ? `Source: ${input.context.currentPage?.url || "browsed page"}\n\n${extracted.slice(0, 4000)}` : "No page text captured. Connect desktop Playwright or paste a public URL."}

| Role | Notes | Outreach draft |
| --- | --- | --- |
| (fill from the page) | Public text only | Do not send |

CINEM Pro will not send these. Approve, then you copy/paste.
`,
  };
  const live = llm.status().configured;
  if (!live) {
    return { ...fallback, tokens: 0, model: "demo", provider: "demo" };
  }
  const result = await llm.complete({
    mode: "draft",
    json: true,
    messages: [
      {
        role: "system",
        content: `You are ${input.agentName} on CINEM Pro.
${input.agentInstructions}
Turn public page text into a markdown table of roles (Role | Notes | Outreach draft). Never claim you emailed anyone. Never invent people who are not on the page.
Return JSON: { "title": string, "content": string }.`,
      },
      {
        role: "user",
        content: `Brand Kit:\n${brandKitBrief(input.kit)}\n\n${pageContextBlock(input.context)}\n\nRequest:\n${input.prompt}`,
      },
    ],
  });
  const json = parseLlmJson(result.text);
  return {
    title: String(json?.title || "").trim() || fallback.title,
    content: String(json?.content || "").trim() || fallback.content,
    tokens: result.tokens,
    model: result.model,
    provider: result.provider,
  };
}

async function generateWhatsAppDrafts(input: {
  kit: BrandKit;
  prompt: string;
  context: JobContext;
  agentName: string;
  agentInstructions: string;
}): Promise<ArtifactPack> {
  const fallback = demoWhatsAppDrafts(input.kit);
  const live = llm.status().configured;
  if (!live) {
    return {
      title: fallback.title,
      content: fallback.content,
      tokens: 0,
      model: "demo",
      provider: "demo",
    };
  }
  const result = await llm.complete({
    mode: "draft",
    json: true,
    messages: [
      {
        role: "system",
        content: `You are ${input.agentName} on CINEM Pro.
${input.agentInstructions}
Write 3 short WhatsApp drafts. Never send. Never claim Twilio delivered anything.
Return JSON: { "title": string, "content": string }.`,
      },
      {
        role: "user",
        content: `Brand Kit:\n${brandKitBrief(input.kit)}\n\nRequest:\n${input.prompt}`,
      },
    ],
  });
  const json = parseLlmJson(result.text);
  return {
    title: String(json?.title || "").trim() || fallback.title,
    content: String(json?.content || "").trim() || fallback.content,
    tokens: result.tokens,
    model: result.model,
    provider: result.provider,
  };
}

export async function completeJobIfApproved(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { artifacts: true },
  });
  if (!job || job.status !== "needs_you") return job;
  if ((job.askKind || "") === "clarify" && !(job.userAnswer || "").trim()) {
    return job;
  }
  const pending = job.artifacts.filter((artifact) => artifact.status !== "approved");
  const approved = job.artifacts.length - pending.length;
  await appendEvent({
    jobId,
    type: "status",
    message: `${approved}/${job.artifacts.length || 0} artifacts approved.`,
  });
  if (pending.length > 0) return job;

  const steps = parsePlan(job.plan).map((step) =>
    step.status === "paused" ? { ...step, status: "done" as const } : step,
  );
  await savePlan(jobId, steps);
  const remaining = steps.filter((step) => step.status === "pending");
  if (remaining.length) {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "queued", askPrompt: "", askKind: "", runnerLock: "" },
    });
    await appendEvent({
      jobId,
      type: "status",
      message: "Approval received — continuing the plan.",
    });
    scheduleJobRun(jobId);
    return loadJob(jobId);
  }
  await closeBrowserSession(jobId);
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "done", askPrompt: "", askKind: "" },
  });
  await appendEvent({
    jobId,
    type: "status",
    message: "All artifacts approved. Job complete. Ops has schedule cards.",
  });
  return loadJob(jobId);
}

export async function answerJobClarification(input: {
  jobId: string;
  workspaceId: string;
  answer: string;
}) {
  const job = await prisma.job.findFirst({
    where: { id: input.jobId, workspaceId: input.workspaceId },
  });
  if (!job) throw new ClientError("Job not found.", 404);
  if (job.status !== "needs_you") {
    throw new ClientError("This job is not waiting for an answer.");
  }
  const steps = parsePlan(job.plan);
  const paused = steps.find((step) => step.status === "paused");
  if (!paused || !isClarifyStep(paused)) {
    throw new ClientError("This pause is an artifact approval, not a Yes/No question.");
  }
  const answer = input.answer.trim();
  if (!answer) throw new ClientError("Write Yes, No, or a short answer.");
  const context = parseJobContext(job.context);
  context.userAnswer = answer;
  context.clarification = {
    question: job.askPrompt || String(paused.args.prompt || ""),
    answer,
    choices: Array.isArray(paused.args.choices)
      ? paused.args.choices.map((row) => String(row))
      : ["Yes", "No"],
  };
  const nextSteps = steps.map((step) =>
    step.status === "paused" ? { ...step, status: "done" as const, result: answer } : step,
  );
  await savePlan(job.id, nextSteps);
  await saveContext(job.id, context);
  await appendEvent({
    jobId: job.id,
    type: "user_reply",
    message: `You answered: ${answer}`,
    stepId: paused.id,
    data: { tool: "ask_user", answer },
  });

  if (isNegativeClarification(answer)) {
    const skipped = nextSteps.map((step) =>
      step.status === "pending"
        ? { ...step, status: "done" as const, result: "Skipped — you said no." }
        : step,
    );
    await savePlan(job.id, skipped);
    await closeBrowserSession(job.id);
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "done",
        askPrompt: "",
        askKind: "clarify",
        userAnswer: answer,
        runnerLock: "",
      },
    });
    await appendEvent({
      jobId: job.id,
      type: "status",
      message: "Stopped after you said no.",
    });
    return loadJob(job.id);
  }

  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: "queued",
      askPrompt: "",
      askKind: "clarify",
      userAnswer: answer,
      runnerLock: "",
    },
  });
  await appendEvent({
    jobId: job.id,
    type: "status",
    message: "Answer received — continuing the plan.",
  });
  scheduleJobRun(job.id);
  return loadJob(job.id);
}

export async function saveSkillFromJob(input: {
  workspaceId: string;
  jobId: string;
  name: string;
}) {
  const job = await prisma.job.findFirst({
    where: { id: input.jobId, workspaceId: input.workspaceId },
  });
  if (!job) throw new Error("Job not found.");
  const playbook = resetPlaybook({
    key: job.playbookKey || "custom",
    title: input.name.trim() || job.title,
    agentRole: asAgentRole(job.agentRole),
    steps: parsePlan(job.plan),
  });
  return prisma.skill.create({
    data: {
      workspaceId: input.workspaceId,
      name: playbook.title,
      agentRole: playbook.agentRole,
      agentId: job.agentId,
      playbook: JSON.stringify(playbook),
      sourceJobId: job.id,
    },
  });
}

export function defaultLinkedInSkillPlaybook() {
  return linkedinWeekPlaybook();
}

export {
  competitorScanPlaybook,
  genericPlaybook,
  inboxInvoicesPlaybook,
  linkedinOutreachDraftPlaybook,
  linkedinWeekPlaybook,
  outreachFromResearchPlaybook,
  recruiterSheetPlaybook,
  researchPackPlaybook,
  salesPackPlaybook,
} from "@/lib/job-playbooks";
