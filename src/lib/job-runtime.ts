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
import { generateAgentArtifact } from "@/lib/agents";
import { demoLinkedInPosts, demoResearchMarkdown } from "@/lib/demo";
import { extractUrls, fetchUrlText } from "@/lib/fetch-url";
import { resolveLivePosts, resolveRunOutput } from "@/lib/live-output";
import {
  genericPlaybook,
  inferPlaybookKey,
  isJobTool,
  linkedinWeekPlaybook,
  parsePlan,
  parsePlaybookJson,
  playbookFromKey,
  researchPackPlaybook,
  resetPlaybook,
  salesPackPlaybook,
} from "@/lib/job-playbooks";
import {
  parseJobContext,
  parseLlmJson,
  serializeJob,
  serializeMessage,
} from "@/lib/job-serialize";
import type { CreateJobResult, JobContext, JobPlaybook, JobStep } from "@/lib/job-types";
import { llm } from "@/lib/llm";
import { connectedToolNames, getConnectedPlugin } from "@/lib/plugins";
import { assertWorkspaceBudget, recordUsage } from "@/lib/usage";
import { tavilySearch } from "@/lib/web-search";

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
  return `${agentName} started **${title}**. I’ll plan, use tools, and pause when something needs you. Watch the activity feed.`;
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
    playbook = playbookFromKey(playbookKey, hintRole, input.message);
  } else {
    playbook = resetPlaybook(playbook);
  }

  if (playbookKey === "research_pack") {
    const url = extractUrls(input.message)[0] || kit.website || "";
    playbook = researchPackPlaybook(url);
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
  for (let i = 0; i < 24; i++) {
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
      const agent = job.agentId
        ? await prisma.agent.findUnique({ where: { id: job.agentId } })
        : null;
      steps = await planSteps({
        workspaceId: job.workspaceId,
        role: asAgentRole(job.agentRole),
        prompt: job.prompt,
        kit: parseBrandKit(workspace.brandKit),
        agentName: displayAgentName(agent?.name),
        agentInstructions: agent?.instructions || "",
        agentRoleLabel: agent?.role || job.agentRole,
      });
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
    const agent = job.agentId
      ? await prisma.agent.findUnique({ where: { id: job.agentId } })
      : null;
    const result = await executeTool({
      workspaceId: job.workspaceId,
      jobId,
      agentId: job.agentId,
      agentRole: asAgentRole(job.agentRole),
      agentName: displayAgentName(agent?.name),
      agentInstructions: agent?.instructions || "",
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
      data: { tool: next.tool, artifactId: result.artifactId },
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
}): Promise<JobStep[]> {
  const fallback = playbookFromKey(
    inferPlaybookKey(input.role, input.prompt),
    input.role,
    input.prompt,
  ).steps;
  if (!llm.status().configured) return fallback;
  const connected = await connectedToolNames(input.workspaceId);
  const webSearchNote = connected.includes("web_search")
    ? "Web Search is Connected — you may include web_search."
    : "Web Search is not Connected — do not include web_search.";
  try {
    const result = await llm.complete({
      mode: "draft",
      json: true,
      messages: [
        {
          role: "system",
          content: `You plan jobs for Brandcrew agent "${input.agentName}" (role label: ${input.agentRoleLabel || input.role}).
${input.agentInstructions ? `Agent instructions:\n${input.agentInstructions}\n` : ""}
Available tools: read_brand_kit, fetch_url, write_artifact, ask_user${connected.includes("web_search") ? ", web_search" : ""}.
${webSearchNote}
Return JSON: { "title": string, "steps": [{ "tool": string, "label": string, "args": object }] }
Rules:
- First step is always read_brand_kit.
- Last step is always ask_user (required before send/publish/spend).
- Max 10 steps. Only listed tools.
- If the user named a URL or asked for research, include fetch_url then write_artifact.
- If they asked to search the web and web_search is available, include it then write_artifact.
- Do not invent send, login, or spend tools.`,
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
    if (steps.length >= 2 && steps[0].tool === "read_brand_kit") return steps;
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
}): Promise<{
  summary: string;
  context: JobContext;
  pause?: boolean;
  askPrompt?: string;
  artifactId?: string;
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
    });
    const fetched = await fetchUrlText(url);
    context.fetched = { url: fetched.url, ok: fetched.ok, text: fetched.text };
    return {
      summary: fetched.ok
        ? `Fetched ${fetched.url} (${fetched.text.length} chars).`
        : `Could not fully fetch ${url}${fetched.error ? ` — ${fetched.error}` : ""}. Will write from what we have.`,
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
    return {
      summary: prompt,
      context,
      pause: true,
      askPrompt: prompt,
    };
  }

  return { summary: `Unknown tool ${step.tool}`, context };
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
  } else {
    const generated = await generateAgentArtifact({
      role: input.agentRole,
      kit: input.kit,
      userMessage: fetchedAwarePrompt(input.prompt, context),
      history: [],
      action:
        kind === "sales_pack"
          ? "sales_pack"
          : kind === "linkedin_week"
            ? "generate_week"
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

function fetchedAwarePrompt(prompt: string, context: JobContext): string {
  const parts = [prompt];
  if (context.fetched?.text) {
    parts.push(`Fetched ${context.fetched.url}:\n${context.fetched.text.slice(0, 8000)}`);
  }
  if (context.search?.text) {
    parts.push(
      `Web search for “${context.search.query}”:\n${context.search.text.slice(0, 8000)}`,
    );
  }
  return parts.join("\n\n");
}

async function generateLinkedInPosts(input: {
  kit: BrandKit;
  prompt: string;
  agentName: string;
  agentInstructions: string;
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
    json: true,
    messages: [
      {
        role: "system",
        content: `You are ${input.agentName} on Brandcrew.
${input.agentInstructions}
Write LinkedIn posts in Brand Kit voice. No forbidden words. Do not claim they were published.
Return JSON: { "posts": [{ "title": string, "body": string }] }`,
      },
      {
        role: "user",
        content: `Brand Kit:\n${brandKitBrief(input.kit)}\n\nRequest:\n${input.prompt}`,
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

async function generateResearchPack(input: {
  kit: BrandKit;
  prompt: string;
  context: JobContext;
  agentName: string;
  agentInstructions: string;
}): Promise<{
  title: string;
  content: string;
  tokens: number;
  model: string;
  provider: string;
}> {
  const fetched = input.context.fetched;
  const live = llm.status().configured;
  const demoContent = demoResearchMarkdown(input.kit, fetched);
  if (!live) {
    const resolved = resolveRunOutput({
      live: false,
      fetched,
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
          content: `You are ${input.agentName} on Brandcrew.
${input.agentInstructions}
Write sourced notes. Do not invent quotes or numbers.
Return JSON: { "title": string, "content": string } Markdown with Source, What the page says, Implications, What not to copy.`,
        },
        {
          role: "user",
          content: `Brand Kit:\n${brandKitBrief(input.kit)}\n\nFetched:\n${
            fetched ? `${fetched.url}\n${fetched.text || fetched.ok}` : "(none)"
          }\n\nWeb search:\n${
            input.context.search
              ? `${input.context.search.query}\n${input.context.search.text}`
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
    // Live path may still persist fetched page text — never canned demo copy.
  }
  const resolved = resolveRunOutput({
    live: true,
    llmTitle,
    llmContent,
    fetched,
    search: input.context.search,
    demoTitle: "Company research notes",
    demoContent,
  });
  return {
    title: resolved.title,
    content: resolved.content,
    tokens,
    model: resolved.source === "tools" ? "fetch_url" : model,
    provider: resolved.source === "tools" ? "tools" : provider,
  };
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
      agentId: job.agentId,
      playbook: JSON.stringify(playbook),
      sourceJobId: job.id,
    },
  });
}

export function defaultLinkedInSkillPlaybook() {
  return linkedinWeekPlaybook();
}

export { linkedinWeekPlaybook, researchPackPlaybook, salesPackPlaybook, genericPlaybook };
