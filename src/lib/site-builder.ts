import { parseBrandKit } from "@/lib/brand-kit";
import { generateBuilderArtifact } from "@/lib/builders";
import { resolveChatWorkspace } from "@/lib/chat";
import { prisma } from "@/lib/db";
import { sanitizeBuilderPreviewHtml } from "@/lib/html-preview";
import { ClientError } from "@/lib/http";
import { limitsForPlan, normalizePlanId } from "@/lib/limits";
import { llm, runWithLlmRouting } from "@/lib/llm";
import { assertLlmCallBudget, recordUsage } from "@/lib/usage";
import { listUserWorkspaces } from "@/lib/workspace";

/**
 * Website builder (Package 11b) — chat-product surface over the desk-era
 * generation engine (src/lib/builders.ts). One project = one single-page
 * website with a full version chain. Publishing is 11d; v1 is preview-only.
 *
 * Honesty rule (house): when no provider key is configured for the
 * "website" job kind, generation refuses with a clear not-configured
 * error. The demo template fallback inside builders.ts is NEVER persisted
 * or shown as AI output here.
 */

export {
  SITE_BUILDER_NOT_CONFIGURED_MESSAGE,
  SITE_GENERATION_TOKEN_CEILING,
  SITE_HTML_MAX_CHARS,
  SITE_PROJECT_CAPS,
  SITE_TEMPLATES,
  siteProjectCapForPlan,
  siteTemplateById,
  type SiteTemplate,
} from "@/lib/site-builder-pure";
import {
  SITE_BUILDER_NOT_CONFIGURED_MESSAGE,
  SITE_GENERATION_TOKEN_CEILING,
  SITE_HTML_MAX_CHARS,
  SITE_TEMPLATES,
  siteProjectCapForPlan,
  siteTemplateById,
} from "@/lib/site-builder-pure";

const DESIGN_SYSTEM_INSTRUCTIONS = `House design system — follow it exactly:
- Assemble ready-made section blocks (hero, about, services, prices, gallery, reviews, contact, footer) instead of inventing layouts.
- Use a professional font pairing and one coherent colour palette; generous spacing; mobile-first (the page must look right on a phone first, desktop second).
- Basic SEO by default: a proper <title>, a meta description, one <h1>, headings in order, readable contrast.
- For business sites, include a WhatsApp contact button block (a link to https://wa.me/ with a placeholder number the owner can change).
- Small inline JavaScript is allowed only for in-page interactivity (menus, filters, sliders, galleries). No external scripts, no trackers, no external stylesheets or fonts — everything inline in the one file.
- Never claim the site is published or live; it is a preview inside CINEM Pro.`;

export function builderConfigured(): boolean {
  return llm.isLiveFor("website");
}

async function primaryWorkspace(userId: string) {
  const workspaces = await listUserWorkspaces(userId);
  return workspaces[0] ?? null;
}

export async function getBuilderStatus(userId: string) {
  const workspace = await primaryWorkspace(userId);
  const plan = normalizePlanId(workspace?.plan);
  const cap = siteProjectCapForPlan(plan);
  const used = workspace
    ? await prisma.siteProject.count({ where: { workspaceId: workspace.id } })
    : 0;
  return {
    configured: builderConfigured(),
    plan,
    projectCap: cap,
    projectCount: used,
    canCreateProject: used < cap,
    templates: SITE_TEMPLATES,
  };
}

export function serializeSiteProject(row: {
  id: string;
  title: string;
  template: string | null;
  status: string;
  currentVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    title: row.title,
    template: row.template,
    status: row.status,
    currentVersionId: row.currentVersionId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeSiteVersion(row: {
  id: string;
  version: number;
  kind: string;
  instruction: string;
  model: string;
  tokens: number;
  createdAt: Date;
}) {
  return {
    id: row.id,
    version: row.version,
    kind: row.kind,
    instruction: row.instruction,
    model: row.model,
    tokens: row.tokens,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listSiteProjects(userId: string) {
  const rows = await prisma.siteProject.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return rows.map(serializeSiteProject);
}

export async function createSiteProject(input: {
  userId: string;
  userName: string;
  title?: string;
  template?: string | null;
}) {
  const workspace = await resolveChatWorkspace(input.userId, input.userName);
  const cap = siteProjectCapForPlan(workspace.plan);
  const count = await prisma.siteProject.count({
    where: { workspaceId: workspace.id },
  });
  if (count >= cap) {
    throw new ClientError(
      `Your plan includes up to ${cap} website${cap === 1 ? "" : "s"}. Upgrade to build more.`,
      403,
      "site_project_cap",
    );
  }
  const template = input.template ? siteTemplateById(input.template) : null;
  const title = input.title?.trim() || template?.defaultTitle || "Untitled website";
  const project = await prisma.siteProject.create({
    data: {
      userId: input.userId,
      workspaceId: workspace.id,
      title,
      template: template?.id ?? null,
    },
  });
  const conversation = await prisma.chatConversation.create({
    data: {
      userId: input.userId,
      workspaceId: workspace.id,
      title,
      siteProjectId: project.id,
    },
  });
  return {
    project: serializeSiteProject(project),
    conversationId: conversation.id,
  };
}

async function loadOwnedProject(userId: string, projectId: string) {
  const project = await prisma.siteProject.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) throw new ClientError("Website not found.", 404, "not_found");
  return project;
}

export async function getSiteProjectDetail(userId: string, projectId: string) {
  const project = await loadOwnedProject(userId, projectId);
  const [versions, conversation] = await Promise.all([
    prisma.siteVersion.findMany({
      where: { projectId: project.id },
      orderBy: { version: "desc" },
      take: 100,
    }),
    prisma.chatConversation.findFirst({
      where: { siteProjectId: project.id, userId },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 200 } },
    }),
  ]);
  const current =
    versions.find((row: { id: string }) => row.id === project.currentVersionId) ??
    versions[0] ??
    null;
  return {
    project: serializeSiteProject(project),
    versions: versions.map(serializeSiteVersion),
    currentVersionId: current?.id ?? null,
    previewHtml: current ? sanitizeBuilderPreviewHtml(current.html) : null,
    messages: (conversation?.messages ?? []).map(
      (row: { id: string; role: string; content: string; createdAt: Date }) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
      }),
    ),
    conversationId: conversation?.id ?? null,
  };
}

async function builderConversationId(projectId: string, userId: string, workspaceId: string, title: string) {
  const existing = await prisma.chatConversation.findFirst({
    where: { siteProjectId: projectId, userId },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.chatConversation.create({
    data: { userId, workspaceId, title, siteProjectId: projectId },
    select: { id: true },
  });
  return created.id;
}

async function appendBuilderMessages(
  conversationId: string,
  instruction: string,
  reply: string,
  model: string,
  tokens: number,
) {
  await prisma.chatMessage.createMany({
    data: [
      { conversationId, role: "user", content: instruction },
      {
        conversationId,
        role: "assistant",
        content: reply,
        model: model || null,
        tokens,
      },
    ],
  });
  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

/** Hourly builder-action cap: reuse the plan's jobs-per-hour number. */
async function assertBuilderHourlyCap(workspaceId: string, plan: string) {
  const limits = limitsForPlan(plan);
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.siteVersion.count({
    where: {
      project: { workspaceId },
      kind: { in: ["generate", "edit"] },
      createdAt: { gte: since },
    },
  });
  if (recent >= limits.jobsPerHour) {
    throw new ClientError(
      "You've hit this hour's website-building limit for your plan. Try again in a little while.",
      429,
      "rate_limited",
    );
  }
}

export async function generateSiteVersion(input: {
  userId: string;
  userName: string;
  projectId: string;
  instruction: string;
}) {
  const instruction = input.instruction.trim();
  if (!instruction) {
    throw new ClientError("Describe the website or the change you want.", 400, "invalid_request");
  }
  if (!builderConfigured()) {
    throw new ClientError(SITE_BUILDER_NOT_CONFIGURED_MESSAGE, 503, "not_configured");
  }
  const project = await loadOwnedProject(input.userId, input.projectId);
  const workspace = await prisma.workspace.findUnique({
    where: { id: project.workspaceId },
  });
  if (!workspace) throw new ClientError("Workspace not found.", 404, "not_found");

  await assertLlmCallBudget(workspace.id, "llm");
  await assertBuilderHourlyCap(workspace.id, workspace.plan);

  const current = project.currentVersionId
    ? await prisma.siteVersion.findUnique({ where: { id: project.currentVersionId } })
    : null;
  const isEdit = Boolean(current);
  const kit = parseBrandKit(workspace.brandKit);
  // First build of a template project carries the template's design
  // direction (palette / layout / sections) so output quality stays high
  // even when the user's own description is one line — the Lovable
  // "remix a finished brief" idea, applied to generation.
  const template = !isEdit && project.template ? siteTemplateById(project.template) : null;
  const prompt = isEdit
    ? [
        "Here is the current one-page website HTML:",
        "```html",
        current!.html.slice(0, SITE_HTML_MAX_CHARS),
        "```",
        "",
        `Apply this change and return the complete updated page: ${instruction}`,
        "Keep everything the user did not ask to change. Return the full page, not a diff.",
      ].join("\n")
    : template?.designDirection
      ? `${instruction}\n\nTemplate design direction (${template.label}) — follow it for palette, layout and section order: ${template.designDirection}`
      : instruction;

  const result = await runWithLlmRouting(
    { workspaceId: workspace.id, plan: workspace.plan, budgetMode: "llm" },
    () =>
      generateBuilderArtifact({
        kind: "website",
        kit,
        prompt,
        agentInstructions: DESIGN_SYSTEM_INSTRUCTIONS,
      }),
  );

  // Honesty: the generator falls back to a demo template when no key is
  // live. That must never be saved or shown as AI output in the builder.
  if (result.demo || !result.content.trim()) {
    throw new ClientError(SITE_BUILDER_NOT_CONFIGURED_MESSAGE, 503, "not_configured");
  }
  if (result.tokens > SITE_GENERATION_TOKEN_CEILING) {
    throw new ClientError(
      "That build was unusually large and was stopped by the per-build safety ceiling. Try a smaller change.",
      400,
      "generation_too_large",
    );
  }
  if (result.content.length > SITE_HTML_MAX_CHARS) {
    throw new ClientError(
      "That build came back larger than a one-page site allows and was not saved. Try a smaller change.",
      400,
      "generation_too_large",
    );
  }

  await recordUsage({
    workspaceId: workspace.id,
    tokens: result.tokens,
    model: result.model,
    agentRole: "website-builder",
  });

  const versionCount = await prisma.siteVersion.count({
    where: { projectId: project.id },
  });
  const version = await prisma.siteVersion.create({
    data: {
      projectId: project.id,
      version: versionCount + 1,
      kind: isEdit ? "edit" : "generate",
      html: result.content,
      instruction,
      model: result.model,
      provider: result.provider,
      tokens: result.tokens,
    },
  });
  const updated = await prisma.siteProject.update({
    where: { id: project.id },
    data: {
      currentVersionId: version.id,
      title: !isEdit && result.title ? result.title : project.title,
    },
  });

  const conversationId = await builderConversationId(
    project.id,
    input.userId,
    workspace.id,
    updated.title,
  );
  const reply = isEdit
    ? `Done — version ${version.version} is in the preview. ${result.summary || "Ask for any other change, or restore an older version any time."}`
    : `Your website is ready — version 1 is in the preview. ${result.summary || "Tell me what to change: colours, prices, sections, anything."}`;
  await appendBuilderMessages(conversationId, instruction, reply, result.model, result.tokens);

  return {
    project: serializeSiteProject(updated),
    version: serializeSiteVersion(version),
    previewHtml: sanitizeBuilderPreviewHtml(version.html),
    reply,
  };
}

export async function restoreSiteVersion(input: {
  userId: string;
  projectId: string;
  versionId: string;
}) {
  const project = await loadOwnedProject(input.userId, input.projectId);
  const source = await prisma.siteVersion.findFirst({
    where: { id: input.versionId, projectId: project.id },
  });
  if (!source) throw new ClientError("Version not found.", 404, "not_found");
  if (project.currentVersionId === source.id) {
    throw new ClientError("That version is already showing.", 400, "invalid_request");
  }
  const versionCount = await prisma.siteVersion.count({
    where: { projectId: project.id },
  });
  const version = await prisma.siteVersion.create({
    data: {
      projectId: project.id,
      version: versionCount + 1,
      kind: "restore",
      html: source.html,
      instruction: `Restored version ${source.version}`,
      model: source.model,
      provider: source.provider,
      tokens: 0,
    },
  });
  const updated = await prisma.siteProject.update({
    where: { id: project.id },
    data: { currentVersionId: version.id },
  });
  const conversationId = await builderConversationId(
    project.id,
    input.userId,
    project.workspaceId,
    updated.title,
  );
  await appendBuilderMessages(
    conversationId,
    `Restore version ${source.version}`,
    `Done — version ${source.version} is back in the preview as version ${version.version}. Nothing was lost; every version stays in the list.`,
    "",
    0,
  );
  return {
    project: serializeSiteProject(updated),
    version: serializeSiteVersion(version),
    previewHtml: sanitizeBuilderPreviewHtml(version.html),
  };
}
