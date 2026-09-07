import { after } from "next/server";
import { prisma } from "@/lib/db";
import {
  AGENT_ROLES,
  employeeDisplayName,
  type AgentRole,
  type ChatTarget,
  type GenerateAction,
} from "@/lib/constants";
import { brandKitBrief, parseBrandKit, type BrandKit } from "@/lib/brand-kit";
import { generateAgentArtifact } from "@/lib/agents";
import {
  demoAdAnglesFromUrl,
  demoCompetitorMarkdown,
  demoLinkedInPosts,
  demoOutreachFromResearch,
  demoResearchMarkdown,
} from "@/lib/demo";
import { plannerSystemPrompt } from "@/lib/employee-prompts";
import { extractUrls, fetchUrlText } from "@/lib/fetch-url";
import {
  browseNavigate,
  browserInteractGuard,
  crawlLinks,
  excerptFromText,
  formatSnapshot,
  MAX_PAGES_PER_JOB,
} from "@/lib/browse";
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
  routeTeamMessage,
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
import { llm } from "@/lib/llm";
import { assertWorkspaceBudget, recordUsage } from "@/lib/usage";

const STEP_GAP_MS = 280;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asAgentRole(value: string): AgentRole {
  return AGENT_ROLES.includes(value as AgentRole) ? (value as AgentRole) : "writer";
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

function assistantIntro(role: AgentRole, title: string) {
  const who = employeeDisplayName(role);
  return `${who} started **${title}**. I’ll plan, use tools, and pause when something needs you. Watch the activity feed.`;
}

export async function createJobFromChat(input: {
  workspaceId: string;
  agentRole: ChatTarget;
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

  let routedFromTeam = false;
  let agentRole: AgentRole =
    input.agentRole === "team"
      ? routeTeamMessage(input.message)
      : asAgentRole(input.agentRole);
  if (input.agentRole === "team") routedFromTeam = true;

  let playbook: JobPlaybook | null = null;
  if (input.skillId) {
    const skill = await prisma.skill.findFirst({
      where: { id: input.skillId, workspaceId: input.workspaceId },
    });
    if (!skill) throw new Error("That skill is not in this workspace.");
    playbook = parsePlaybookJson(skill.playbook);
    agentRole = asAgentRole(skill.agentRole);
  }

  const playbookKey =
    input.playbookKey ||
    playbook?.key ||
    inferPlaybookKey(agentRole, input.message, input.action);

  if (!playbook) {
    playbook = playbookFromKey(playbookKey, agentRole, input.message, kit.website);
  } else {
    playbook = resetPlaybook(playbook);
  }

  const conversation = await prisma.conversation.upsert({
    where: {
      workspaceId_agentRole: { workspaceId: input.workspaceId, agentRole },
    },
    create: { workspaceId: input.workspaceId, agentRole },
    update: {},
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
      agentRole,
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
      content: routedFromTeam ? `@team ${input.message}` : input.message,
    },
  });
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: assistantIntro(agentRole, playbook.title),
    },
  });

  await appendEvent({
    jobId: job.id,
    type: "created",
    message: `${employeeDisplayName(agentRole)} queued ${playbook.title}.`,
    data: { playbookKey: playbook.key },
  });

  scheduleJobRun(job.id);

  const hydrated = await loadJob(job.id);
  return {
    job: serializeJob(hydrated!),
    messages: [serializeMessage(userMessage), serializeMessage(assistantMessage)],
    routedFromTeam,
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

    let steps = parsePlan(job.plan);
    if (!steps.length) {
      steps = await planSteps(
        job.agentRole as AgentRole,
        job.prompt,
        parseBrandKit(workspace.brandKit),
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
    const result = await executeTool({
      workspaceId: job.workspaceId,
      jobId,
      agentRole: asAgentRole(job.agentRole),
      prompt: job.prompt,
      step: next,
      kit,
      context,
    });

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
          runnerLock: "",
        },
      });
      const conversation = await prisma.conversation.findUnique({
        where: {
          workspaceId_agentRole: {
            workspaceId: job.workspaceId,
            agentRole: job.agentRole,
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
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "failed", error: message, runnerLock: "" },
  });
  await appendEvent({ jobId, type: "error", message });
}

async function planSteps(role: AgentRole, prompt: string, kit: BrandKit): Promise<JobStep[]> {
  const fallback = playbookFromKey(inferPlaybookKey(role, prompt), role, prompt, kit.website).steps;
  if (!llm.status().configured) return fallback;
  try {
    const result = await llm.complete({
      mode: "draft",
      json: true,
      messages: [
        {
          role: "system",
          content: plannerSystemPrompt(role),
        },
        {
          role: "user",
          content: `Brand Kit:\n${brandKitBrief(kit)}\n\nUser request:\n${prompt}`,
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
  agentRole: AgentRole;
  prompt: string;
  step: JobStep;
  kit: BrandKit;
  context: JobContext;
}): Promise<{
  summary: string;
  context: JobContext;
  pause?: boolean;
  askPrompt?: string;
  artifactId?: string;
  url?: string;
  excerpt?: string;
}> {
  const { step, kit } = input;
  const context = { ...input.context };

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
      const page = toBrowsedPage(await browseNavigate(url));
      rememberPage(context, page);
      return {
        summary: page.ok
          ? `browser_navigate ${page.url} (${page.engine})`
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
    return { summary: guard.reason, context };
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
        summary: "No research artifact on this desk yet — Sam will write from the Brand Kit only.",
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
      "Approve the drafts before they leave the desk. Brandcrew will not send or publish.";
    return {
      summary: prompt,
      context,
      pause: true,
      askPrompt: prompt,
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

function rememberPage(context: JobContext, page: BrowsedPage) {
  context.pages = [...(context.pages || []), page];
  context.currentPage = page;
  context.pageCount = (context.pageCount || 0) + 1;
  context.fetched = { url: page.url, ok: page.ok, text: page.text };
}

async function writeJobArtifact(
  input: {
    workspaceId: string;
    jobId: string;
    agentRole: AgentRole;
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

  if (kind === "linkedin_post") {
    if (!context.weekPosts?.length) {
      const generated = await generateLinkedInPosts(input.kit, input.prompt, context);
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
    const pack = await generateResearchPack(input.kit, input.prompt, context);
    title = pack.title;
    content = pack.content;
    type = "research_pack";
    model = pack.model;
    provider = pack.provider;
    tokens = pack.tokens;
  } else if (kind === "competitor_scan") {
    const pack = await generateCompetitorScan(input.kit, input.prompt, context);
    title = pack.title;
    content = pack.content;
    type = "competitor_scan";
    model = pack.model;
    provider = pack.provider;
    tokens = pack.tokens;
  } else if (kind === "outreach_pack") {
    const pack = await generateOutreachPack(input.kit, input.prompt, context);
    title = pack.title;
    content = pack.content;
    type = "outreach_pack";
    model = pack.model;
    provider = pack.provider;
    tokens = pack.tokens;
  } else if (kind === "ad_angles") {
    const pack = await generateAdAngles(input.kit, input.prompt, context);
    title = pack.title;
    content = pack.content;
    type = "ad_angles";
    model = pack.model;
    provider = pack.provider;
    tokens = pack.tokens;
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
            : "default",
    });
    title = generated.artifact.title;
    content = generated.artifact.content;
    type = generated.artifact.type;
    model = generated.model;
    provider = generated.provider;
    tokens = generated.tokens;
  }

  const conversation = await prisma.conversation.upsert({
    where: {
      workspaceId_agentRole: {
        workspaceId: input.workspaceId,
        agentRole: input.agentRole,
      },
    },
    create: { workspaceId: input.workspaceId, agentRole: input.agentRole },
    update: {},
  });

  const artifact = await prisma.artifact.create({
    data: {
      workspaceId: input.workspaceId,
      conversationId: conversation.id,
      jobId: input.jobId,
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
  });

  return { id: artifact.id, title, context };
}

async function generateLinkedInPosts(
  kit: BrandKit,
  prompt: string,
  context?: JobContext,
): Promise<{
  posts: { title: string; body: string }[];
  tokens: number;
  model: string;
  provider: string;
}> {
  const fallback = demoLinkedInPosts(kit);
  if (!llm.status().configured) {
    return { posts: fallback, tokens: 0, model: "demo", provider: "demo" };
  }
  try {
    const result = await llm.complete({
      mode: "draft",
      json: true,
      messages: [
        {
          role: "system",
          content: `You are Maya, the Writer on Brandcrew.
Write LinkedIn posts in Brand Kit voice. No forbidden words. Do not claim they were published.
If page text is provided, ground the posts in it.
Return JSON: { "posts": [{ "title": string, "body": string }] }`,
        },
        {
          role: "user",
          content: `Brand Kit:\n${brandKitBrief(kit)}\n\n${pageContextBlock(context)}\n\nRequest:\n${prompt}`,
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
      posts: posts.length >= 1 ? posts.slice(0, 5) : fallback,
      tokens: result.tokens,
      model: result.model,
      provider: result.provider,
    };
  } catch {
    return { posts: fallback, tokens: 0, model: "demo", provider: "demo" };
  }
}

async function generateResearchPack(
  kit: BrandKit,
  prompt: string,
  context: JobContext,
): Promise<{
  title: string;
  content: string;
  tokens: number;
  model: string;
  provider: string;
}> {
  const fetched = context.fetched;
  const fallback = demoResearchMarkdown(kit, fetched);
  if (!llm.status().configured) {
    return {
      title: "Company research pack",
      content: fallback,
      tokens: 0,
      model: "demo",
      provider: "demo",
    };
  }
  try {
    const result = await llm.complete({
      mode: "draft",
      json: true,
      messages: [
        {
          role: "system",
          content: `You are Omar, the Researcher on Brandcrew.
Write a research pack. Do not invent quotes or numbers.
Return JSON: { "title": string, "content": string } where content is Markdown with Source, What the site says, Messaging implications, What not to copy.`,
        },
        {
          role: "user",
          content: `Brand Kit:\n${brandKitBrief(kit)}\n\n${pageContextBlock(context)}\n\nRequest:\n${prompt}`,
        },
      ],
    });
    const json = parseLlmJson(result.text);
    return {
      title: String(json?.title || "Company research pack"),
      content: String(json?.content || fallback),
      tokens: result.tokens,
      model: result.model,
      provider: result.provider,
    };
  } catch {
    return {
      title: "Company research pack",
      content: fallback,
      tokens: 0,
      model: "demo",
      provider: "demo",
    };
  }
}

async function generateCompetitorScan(
  kit: BrandKit,
  prompt: string,
  context: JobContext,
): Promise<{
  title: string;
  content: string;
  tokens: number;
  model: string;
  provider: string;
}> {
  const fallback = demoCompetitorMarkdown(kit, context.pages);
  if (!llm.status().configured) {
    return {
      title: "Competitor scan",
      content: fallback,
      tokens: 0,
      model: "demo",
      provider: "demo",
    };
  }
  try {
    const result = await llm.complete({
      mode: "draft",
      json: true,
      messages: [
        {
          role: "system",
          content: `You are Omar, the Researcher on Brandcrew.
Write a competitor comparison from browsed pages only. No invented quotes.
Return JSON: { "title": string, "content": string } Markdown with one section per URL plus Comparison and What not to copy.`,
        },
        {
          role: "user",
          content: `Brand Kit:\n${brandKitBrief(kit)}\n\n${pageContextBlock(context)}\n\nRequest:\n${prompt}`,
        },
      ],
    });
    const json = parseLlmJson(result.text);
    return {
      title: String(json?.title || "Competitor scan"),
      content: String(json?.content || fallback),
      tokens: result.tokens,
      model: result.model,
      provider: result.provider,
    };
  } catch {
    return {
      title: "Competitor scan",
      content: fallback,
      tokens: 0,
      model: "demo",
      provider: "demo",
    };
  }
}

async function generateOutreachPack(
  kit: BrandKit,
  prompt: string,
  context: JobContext,
): Promise<{
  title: string;
  content: string;
  tokens: number;
  model: string;
  provider: string;
}> {
  const fallback = demoOutreachFromResearch(kit, context.priorArtifact);
  if (!llm.status().configured) {
    return {
      title: fallback.title,
      content: fallback.content,
      tokens: 0,
      model: "demo",
      provider: "demo",
    };
  }
  try {
    const result = await llm.complete({
      mode: "draft",
      json: true,
      messages: [
        {
          role: "system",
          content: `You are Sam, the SDR on Brandcrew.
Write exactly 5 LinkedIn DMs. Do not send. Ground them in the research artifact when present.
Return JSON: { "title": string, "content": string } Markdown with ## LinkedIn DM 1 … 5.`,
        },
        {
          role: "user",
          content: `Brand Kit:\n${brandKitBrief(kit)}\n\nResearch artifact:\n${
            context.priorArtifact
              ? `${context.priorArtifact.title}\n${context.priorArtifact.content}`
              : "(none)"
          }\n\nRequest:\n${prompt}`,
        },
      ],
    });
    const json = parseLlmJson(result.text);
    return {
      title: String(json?.title || fallback.title),
      content: String(json?.content || fallback.content),
      tokens: result.tokens,
      model: result.model,
      provider: result.provider,
    };
  } catch {
    return {
      title: fallback.title,
      content: fallback.content,
      tokens: 0,
      model: "demo",
      provider: "demo",
    };
  }
}

async function generateAdAngles(
  kit: BrandKit,
  prompt: string,
  context: JobContext,
): Promise<{
  title: string;
  content: string;
  tokens: number;
  model: string;
  provider: string;
}> {
  const fallback = demoAdAnglesFromUrl(kit, context.fetched);
  if (!llm.status().configured) {
    return {
      title: fallback.title,
      content: fallback.content,
      tokens: 0,
      model: "demo",
      provider: "demo",
    };
  }
  try {
    const result = await llm.complete({
      mode: "draft",
      json: true,
      messages: [
        {
          role: "system",
          content: `You are Lex, Ads on Brandcrew.
Write 5 ad angles with primary text from the landing page. Creative only — no media buy.
Return JSON: { "title": string, "content": string }.`,
        },
        {
          role: "user",
          content: `Brand Kit:\n${brandKitBrief(kit)}\n\n${pageContextBlock(context)}\n\nRequest:\n${prompt}`,
        },
      ],
    });
    const json = parseLlmJson(result.text);
    return {
      title: String(json?.title || fallback.title),
      content: String(json?.content || fallback.content),
      tokens: result.tokens,
      model: result.model,
      provider: result.provider,
    };
  } catch {
    return {
      title: fallback.title,
      content: fallback.content,
      tokens: 0,
      model: "demo",
      provider: "demo",
    };
  }
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
  return `Pages:\n${pages}${snap}`;
}

function pageAwarePrompt(prompt: string, context: JobContext): string {
  const block = pageContextBlock(context);
  if (block.includes("(none)") && !context.priorArtifact) return prompt;
  return `${prompt}\n\n${block}${
    context.priorArtifact
      ? `\n\nPrior artifact ${context.priorArtifact.title}:\n${context.priorArtifact.content.slice(0, 2000)}`
      : ""
  }`;
}

export async function completeJobIfApproved(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { artifacts: true },
  });
  if (!job || job.status !== "needs_you") return job;
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
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "done", askPrompt: "" },
  });
  await appendEvent({
    jobId,
    type: "status",
    message: "All artifacts approved. Job complete. Ops has schedule cards.",
  });
  return loadJob(jobId);
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
  linkedinWeekPlaybook,
  outreachFromResearchPlaybook,
  researchPackPlaybook,
  salesPackPlaybook,
} from "@/lib/job-playbooks";
