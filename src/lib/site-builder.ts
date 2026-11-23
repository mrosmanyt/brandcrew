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
  SITE_ASSET_MAX_PER_PROJECT,
  SITE_BUILDER_NOT_CONFIGURED_MESSAGE,
  SITE_GENERATION_TOKEN_CEILING,
  SITE_HTML_MAX_CHARS,
  SITE_MULTIPAGE_MAX_CHARS,
  SITE_TEMPLATES,
  applyWhatsAppButton,
  base64ByteSize,
  buildMultiPageDocument,
  buildPreviewShellHtml,
  detectWhatsAppToggle,
  injectPreviewNav,
  isSiteLanguage,
  normalizeWhatsAppNumber,
  parseMultiPageOutput,
  pickSiteSlug,
  publishedSiteUrl,
  siteAssetUrl,
  siteAssetValidationError,
  siteLanguagePromptBlock,
  siteProjectCapForPlan,
  siteTemplateById,
  slugifySiteTitle,
  whatsAppLink,
  type SiteLanguage,
  type SitePageDraft,
} from "@/lib/site-builder-pure";

const DESIGN_SYSTEM_INSTRUCTIONS = `House design system — follow it exactly:
- Assemble ready-made section blocks (hero, about, services, prices, gallery, reviews, contact, footer) instead of inventing layouts.
- Use a professional font pairing and one coherent colour palette; generous spacing; mobile-first (the page must look right on a phone first, desktop second).
- Basic SEO by default: a proper <title>, a meta description, one <h1>, headings in order, readable contrast.
- For business sites, include a WhatsApp contact button block (a link to https://wa.me/ with a placeholder number the owner can change).
- Small inline JavaScript is allowed only for in-page interactivity (menus, filters, sliders, galleries). No external scripts, no trackers, no external stylesheets or fonts — everything inline in the one file.
- Multi-page: when the site naturally splits into pages (Home plus About, Menu, Services, Gallery, Contact…), return one complete self-contained HTML document per page, each preceded by its own marker line: <<<PAGE path="/" title="Home">>> for the home page, <<<PAGE path="/about" title="About">>> for the others. Link between pages with root-relative links (href="/about"). Repeat the shared header/nav/footer on every page so each page stands on its own. When the business is simple, one rich page (with the home marker) is better than several thin ones.
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
  // Publication summaries ride along fail-safe (the table may not exist
  // in a database yet — the list must still load exactly as v1).
  let publications = new Map<string, PublicationRow>();
  try {
    const pubs = await prisma.sitePublication.findMany({
      where: { projectId: { in: rows.map((row: { id: string }) => row.id) } },
    });
    publications = new Map(
      pubs.map((pub: PublicationRow) => [pub.projectId, pub] as const),
    );
  } catch {
    publications = new Map();
  }
  return rows.map((row: (typeof rows)[number]) => ({
    ...serializeSiteProject(row),
    publication: serializePublication(
      publications.get(row.id) ?? null,
      row.currentVersionId,
      null,
    ),
  }));
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
  const publication = await getProjectPublicationSummary(
    project.id,
    project.currentVersionId,
  );
  const currentPages = current ? await loadVersionPagesSafe(current.id) : [];
  const assets = await listSiteAssetsSafe(project.id);
  const settings = await getSiteSettingsSafe(project.id);
  return {
    project: serializeSiteProject(project),
    publication,
    settings: serializeSiteSettings(settings),
    assets: assets.map(serializeSiteAsset),
    versions: versions.map(serializeSiteVersion),
    currentVersionId: current?.id ?? null,
    pages:
      currentPages.length > 0
        ? [
            { path: "/", title: "Home" },
            ...currentPages.map((page) => ({
              path: `/${page.path}`,
              title: page.title || page.path,
            })),
          ]
        : [],
    previewHtml: current
      ? buildVersionPreviewHtml(
          current.html,
          currentPages,
          whatsAppTransform(settings),
        )
      : null,
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

/* ------------------------------------------------------------------ */
/* Multi-page storage (Package 11c). All SitePage access is fail-safe: */
/* until the migration SQL lands in a database, versions behave       */
/* exactly like v1 single-page sites.                                  */
/* ------------------------------------------------------------------ */

type SitePageRow = {
  id: string;
  versionId: string;
  path: string;
  title: string;
  html: string;
  sort: number;
};

export async function loadVersionPagesSafe(
  versionId: string | null | undefined,
): Promise<SitePageDraft[]> {
  if (!versionId) return [];
  try {
    const rows = (await prisma.sitePage.findMany({
      where: { versionId },
      orderBy: { sort: "asc" },
    })) as SitePageRow[];
    return rows.map((row) => ({
      path: row.path,
      title: row.title,
      html: row.html,
    }));
  } catch {
    return [];
  }
}

/** Persist a version's sub-pages. False when the table is unavailable. */
async function saveVersionPages(
  versionId: string,
  pages: SitePageDraft[],
): Promise<boolean> {
  if (pages.length === 0) return true;
  try {
    await prisma.sitePage.createMany({
      data: pages.map((page, index) => ({
        versionId,
        path: page.path,
        title: page.title,
        html: page.html,
        sort: index,
      })),
    });
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Uploaded photos/logos (Package C). Reads are fail-safe like the     */
/* other post-v1 tables; writes surface the honest setup error.        */
/* ------------------------------------------------------------------ */

const ASSETS_SETUP_MESSAGE =
  "Photo uploads are still being set up on this server. Try again in a little while.";

type SiteAssetRow = {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
};

export function serializeSiteAsset(row: SiteAssetRow) {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    url: siteAssetUrl(row.id),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listSiteAssetsSafe(
  projectId: string,
): Promise<SiteAssetRow[]> {
  try {
    return (await prisma.siteAsset.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        projectId: true,
        userId: true,
        name: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    })) as SiteAssetRow[];
  } catch {
    return [];
  }
}

export async function uploadSiteAsset(input: {
  userId: string;
  projectId: string;
  name: string;
  mimeType: string;
  dataBase64: string;
}) {
  const project = await loadOwnedProject(input.userId, input.projectId);
  const dataBase64 = input.dataBase64.replace(/\s+/g, "");
  const sizeBytes = base64ByteSize(dataBase64);
  const invalid = siteAssetValidationError({
    mimeType: input.mimeType,
    sizeBytes,
  });
  if (invalid) throw new ClientError(invalid, 400, "invalid_request");
  try {
    const count = await prisma.siteAsset.count({
      where: { projectId: project.id },
    });
    if (count >= SITE_ASSET_MAX_PER_PROJECT) {
      throw new ClientError(
        `A website can keep up to ${SITE_ASSET_MAX_PER_PROJECT} uploaded photos. Delete one to add another.`,
        400,
        "invalid_request",
      );
    }
    const row = (await prisma.siteAsset.create({
      data: {
        projectId: project.id,
        userId: input.userId,
        name: input.name.trim().slice(0, 120) || "Photo",
        mimeType: input.mimeType,
        sizeBytes,
        dataBase64,
      },
    })) as SiteAssetRow;
    return serializeSiteAsset(row);
  } catch (error) {
    if (error instanceof ClientError) throw error;
    if (isMissingRelationError(error)) {
      throw new ClientError(ASSETS_SETUP_MESSAGE, 503, "not_configured");
    }
    throw error;
  }
}

export async function deleteSiteAsset(input: {
  userId: string;
  assetId: string;
}) {
  try {
    const row = await prisma.siteAsset.findFirst({
      where: { id: input.assetId, userId: input.userId },
      select: { id: true },
    });
    if (!row) throw new ClientError("Photo not found.", 404, "not_found");
    await prisma.siteAsset.delete({ where: { id: row.id } });
    return { deleted: true };
  } catch (error) {
    if (error instanceof ClientError) throw error;
    if (isMissingRelationError(error)) {
      throw new ClientError(ASSETS_SETUP_MESSAGE, 503, "not_configured");
    }
    throw error;
  }
}

/** Public raw read for the /site-assets/<id> route. Fail-safe null. */
export async function getSiteAssetRaw(assetId: string) {
  try {
    const row = await prisma.siteAsset.findUnique({
      where: { id: assetId },
      select: { mimeType: true, dataBase64: true },
    });
    return row ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Per-project settings (Package D+). One row per project; reads are   */
/* fail-safe (defaults until the table exists), writes surface the    */
/* honest setup error.                                                 */
/* ------------------------------------------------------------------ */

const SETTINGS_SETUP_MESSAGE =
  "Site settings are still being set up on this server. Try again in a little while.";

export type SiteSettingsData = {
  whatsappNumber: string | null;
  whatsappEnabled: boolean;
  language: SiteLanguage;
};

export const DEFAULT_SITE_SETTINGS: SiteSettingsData = {
  whatsappNumber: null,
  whatsappEnabled: true,
  language: "en",
};

export function serializeSiteSettings(settings: SiteSettingsData) {
  return {
    whatsappNumber: settings.whatsappNumber,
    whatsappEnabled: settings.whatsappEnabled,
    language: settings.language,
    whatsappLink: settings.whatsappNumber
      ? whatsAppLink(settings.whatsappNumber)
      : null,
  };
}

export async function getSiteSettingsSafe(
  projectId: string,
): Promise<SiteSettingsData> {
  let base: SiteSettingsData = { ...DEFAULT_SITE_SETTINGS };
  try {
    const row = await prisma.siteSettings.findUnique({
      where: { projectId },
      select: { whatsappNumber: true, whatsappEnabled: true },
    });
    if (row) {
      base = {
        ...base,
        whatsappNumber: normalizeWhatsAppNumber(row.whatsappNumber),
        whatsappEnabled: row.whatsappEnabled,
      };
    }
  } catch {
    return base;
  }
  // The language column arrived a package later than the table itself —
  // read it separately so a not-yet-applied column can never poison the
  // WhatsApp fields above.
  try {
    const row = await prisma.siteSettings.findUnique({
      where: { projectId },
      select: { language: true },
    });
    if (row && isSiteLanguage(row.language)) {
      base = { ...base, language: row.language };
    }
  } catch {
    /* column not applied yet — English default stands */
  }
  return base;
}

export async function updateSiteSettings(input: {
  userId: string;
  projectId: string;
  whatsappNumber?: string | null;
  whatsappEnabled?: boolean;
  language?: SiteLanguage;
}): Promise<SiteSettingsData> {
  const project = await loadOwnedProject(input.userId, input.projectId);
  const data: {
    whatsappNumber?: string | null;
    whatsappEnabled?: boolean;
    language?: string;
  } = {};
  if (input.whatsappNumber !== undefined) {
    if (input.whatsappNumber === null || input.whatsappNumber.trim() === "") {
      data.whatsappNumber = null;
    } else {
      const normalized = normalizeWhatsAppNumber(input.whatsappNumber);
      if (!normalized) {
        throw new ClientError(
          "That WhatsApp number doesn't look right — use the full international format, e.g. 92 300 1234567.",
          400,
          "invalid_request",
        );
      }
      data.whatsappNumber = normalized;
    }
  }
  if (input.whatsappEnabled !== undefined) {
    data.whatsappEnabled = input.whatsappEnabled;
  }
  if (input.language !== undefined) {
    data.language = input.language;
  }
  try {
    const row = await prisma.siteSettings.upsert({
      where: { projectId: project.id },
      create: { projectId: project.id, ...data },
      update: data,
      select: { whatsappNumber: true, whatsappEnabled: true },
    });
    // Read back through the fail-safe path so a not-yet-applied language
    // column degrades to the English default instead of failing the save.
    return await getSiteSettingsSafe(project.id);
  } catch (error) {
    if (error instanceof ClientError) throw error;
    if (isMissingRelationError(error)) {
      throw new ClientError(SETTINGS_SETUP_MESSAGE, 503, "not_configured");
    }
    throw error;
  }
}

export async function getSiteSettingsForUser(userId: string, projectId: string) {
  const project = await loadOwnedProject(userId, projectId);
  return serializeSiteSettings(await getSiteSettingsSafe(project.id));
}

/** The serving-time page transform for the WhatsApp button (Package D). */
export function whatsAppTransform(settings: SiteSettingsData) {
  return (html: string) =>
    applyWhatsAppButton(html, {
      number: settings.whatsappNumber,
      enabled: settings.whatsappEnabled,
    });
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

  // WhatsApp settings (Package D): a plain chat toggle ("WhatsApp
  // button hata do / laga do") flips the setting first; the build then
  // runs with the number + on/off state as a hard instruction, and the
  // preview/published serving guarantees the floating button.
  let settings = await getSiteSettingsSafe(project.id);
  const toggle = detectWhatsAppToggle(instruction);
  if (toggle && settings.whatsappEnabled !== (toggle === "on")) {
    try {
      settings = await updateSiteSettings({
        userId: input.userId,
        projectId: project.id,
        whatsappEnabled: toggle === "on",
      });
    } catch {
      settings = { ...settings, whatsappEnabled: toggle === "on" };
    }
  }

  await assertLlmCallBudget(workspace.id, "llm");
  await assertBuilderHourlyCap(workspace.id, workspace.plan);

  const current = project.currentVersionId
    ? await prisma.siteVersion.findUnique({ where: { id: project.currentVersionId } })
    : null;
  const isEdit = Boolean(current);
  const currentPages = isEdit ? await loadVersionPagesSafe(current!.id) : [];
  const kit = parseBrandKit(workspace.brandKit);
  // First build of a template project carries the template's design
  // direction (palette / layout / sections) so output quality stays high
  // even when the user's own description is one line — the Lovable
  // "remix a finished brief" idea, applied to generation.
  const template = !isEdit && project.template ? siteTemplateById(project.template) : null;
  const prompt = isEdit
    ? currentPages.length > 0
      ? [
          "Here is the current website — it has several pages, one document per page, each preceded by its page marker:",
          buildMultiPageDocument(current!.html, currentPages).slice(
            0,
            SITE_MULTIPAGE_MAX_CHARS,
          ),
          "",
          `Apply this change and return the COMPLETE updated set of pages, every page with its marker line, even the pages you did not change: ${instruction}`,
          "Keep everything the user did not ask to change. Return full pages, not diffs.",
        ].join("\n")
      : [
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

  // Uploaded photos/logos (Package C): hand the model the exact URLs so
  // "use my logo" works — generated pages reference /site-assets/<id>,
  // which resolves in the preview and on the published site alike.
  const assets = await listSiteAssetsSafe(project.id);
  const promptBlocks: string[] = [prompt];
  if (assets.length > 0) {
    promptBlocks.push(
      "",
      "The owner has uploaded these images for this website — use these exact URLs in <img src> wherever the owner mentions them or they naturally fit (logo in the header, photos in the gallery, product photos):",
      ...assets.map((asset) => `- ${asset.name}: ${siteAssetUrl(asset.id)}`),
    );
  }
  const languageBlock = siteLanguagePromptBlock(settings.language);
  if (languageBlock) {
    promptBlocks.push("", languageBlock);
  }
  if (!settings.whatsappEnabled) {
    promptBlocks.push(
      "",
      "WhatsApp: the owner has switched WhatsApp OFF for this site — do not include any WhatsApp button or wa.me link anywhere.",
    );
  } else if (settings.whatsappNumber) {
    promptBlocks.push(
      "",
      `WhatsApp: every WhatsApp button on the site must link to ${whatsAppLink(settings.whatsappNumber)} — use exactly this number, no other.`,
    );
  }
  const finalPrompt = promptBlocks.join("\n");

  const result = await runWithLlmRouting(
    { workspaceId: workspace.id, plan: workspace.plan, budgetMode: "llm" },
    () =>
      generateBuilderArtifact({
        kind: "website",
        kit,
        prompt: finalPrompt,
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
  // Multi-page (11c): split the result when it carries page markers.
  // An edit that comes back as a single document against a multi-page
  // site replaces the home page and carries the other pages forward —
  // a small change never silently deletes pages.
  const parsed = parseMultiPageOutput(result.content);
  let homeHtml: string;
  let nextPages: SitePageDraft[];
  if (parsed) {
    homeHtml = parsed.home;
    nextPages = parsed.pages;
  } else if (isEdit && currentPages.length > 0) {
    homeHtml = result.content;
    nextPages = currentPages;
  } else {
    homeHtml = result.content;
    nextPages = [];
  }
  const totalChars =
    homeHtml.length + nextPages.reduce((sum, page) => sum + page.html.length, 0);
  if (
    homeHtml.length > SITE_HTML_MAX_CHARS ||
    nextPages.some((page) => page.html.length > SITE_HTML_MAX_CHARS) ||
    totalChars > SITE_MULTIPAGE_MAX_CHARS
  ) {
    throw new ClientError(
      "That build came back larger than a website allows and was not saved. Try a smaller change.",
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
      html: homeHtml,
      instruction,
      model: result.model,
      provider: result.provider,
      tokens: result.tokens,
    },
  });
  const pagesSaved = await saveVersionPages(version.id, nextPages);
  const savedPages = pagesSaved ? nextPages : [];
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
  const pageNote =
    savedPages.length > 0
      ? ` It has ${savedPages.length + 1} pages — use the page buttons above the preview to look through them.`
      : nextPages.length > 0
        ? " The extra pages are saved with the build and will appear once page storage finishes setting up on this server."
        : "";
  const reply = isEdit
    ? `Done — version ${version.version} is in the preview.${pageNote} ${result.summary || "Ask for any other change, or restore an older version any time."}`
    : `Your website is ready — version 1 is in the preview.${pageNote} ${result.summary || "Tell me what to change: colours, prices, sections, anything."}`;
  await appendBuilderMessages(conversationId, instruction, reply, result.model, result.tokens);

  return {
    project: serializeSiteProject(updated),
    version: serializeSiteVersion(version),
    previewHtml: buildVersionPreviewHtml(
      version.html,
      savedPages,
      whatsAppTransform(settings),
    ),
    reply,
  };
}

/**
 * The preview document for one version: the sanitized home page for a
 * single-page site (v1 behaviour), or the multi-page preview shell —
 * every page sanitized, nav interceptor injected, pages in the shell
 * map — when the version has sub-pages.
 */
export function buildVersionPreviewHtml(
  homeHtml: string,
  pages: SitePageDraft[],
  transform?: (html: string) => string,
): string {
  const apply = (html: string) => {
    const sanitized = sanitizeBuilderPreviewHtml(html);
    return transform ? transform(sanitized) : sanitized;
  };
  if (pages.length === 0) return apply(homeHtml);
  const known = ["/", ...pages.map((page) => `/${page.path}`)];
  const all = [
    { path: "/", html: injectPreviewNav(apply(homeHtml), known) },
    ...pages.map((page) => ({
      path: `/${page.path}`,
      html: injectPreviewNav(apply(page.html), known),
    })),
  ];
  return buildPreviewShellHtml({ entryPath: "/", pages: all });
}

/* ------------------------------------------------------------------ */
/* Publishing (Package 11d)                                            */
/*                                                                     */
/* A publication pins one version to a free subdomain served from      */
/* inside this app. Every read of the SitePublication table is wrapped */
/* fail-safe: until the migration SQL reaches a given database, the    */
/* builder keeps working exactly as v1 and publishing reports an       */
/* honest "being set up" error instead of breaking the page.           */
/* ------------------------------------------------------------------ */

export function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  if (code === "P2021" || code === "P2022") return true;
  const message = error instanceof Error ? error.message : String(error);
  return /does not exist/i.test(message) && /(table|column|relation)/i.test(message);
}

const PUBLISHING_SETUP_MESSAGE =
  "Publishing is still being set up on this server. Try again in a little while — your website and versions are safe.";

type PublicationRow = {
  id: string;
  projectId: string;
  slug: string;
  versionId: string | null;
  isLive: boolean;
  publishedAt: Date;
  updatedAt: Date;
};

export function serializePublication(
  row: PublicationRow | null,
  currentVersionId: string | null,
  publishedVersionNumber: number | null,
) {
  if (!row) return null;
  return {
    slug: row.slug,
    url: publishedSiteUrl(row.slug),
    isLive: row.isLive && Boolean(row.versionId),
    publishedVersionId: row.versionId,
    publishedVersion: publishedVersionNumber,
    liveIsCurrent: Boolean(row.versionId) && row.versionId === currentVersionId,
    publishedAt: row.publishedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getPublicationSafe(projectId: string): Promise<PublicationRow | null> {
  try {
    return await prisma.sitePublication.findUnique({ where: { projectId } });
  } catch {
    return null;
  }
}

async function publishedVersionNumber(
  publication: PublicationRow | null,
): Promise<number | null> {
  if (!publication?.versionId) return null;
  try {
    const version = await prisma.siteVersion.findUnique({
      where: { id: publication.versionId },
      select: { version: true },
    });
    return version?.version ?? null;
  } catch {
    return null;
  }
}

export async function getProjectPublicationSummary(
  projectId: string,
  currentVersionId: string | null,
) {
  const publication = await getPublicationSafe(projectId);
  const versionNumber = await publishedVersionNumber(publication);
  return serializePublication(publication, currentVersionId, versionNumber);
}

export async function publishSiteProject(input: {
  userId: string;
  projectId: string;
}) {
  const project = await loadOwnedProject(input.userId, input.projectId);
  if (!project.currentVersionId) {
    throw new ClientError(
      "Build your website first — there is no version to publish yet.",
      400,
      "invalid_request",
    );
  }
  let publication: PublicationRow;
  try {
    const existing = await prisma.sitePublication.findUnique({
      where: { projectId: project.id },
    });
    if (existing) {
      publication = await prisma.sitePublication.update({
        where: { id: existing.id },
        data: {
          versionId: project.currentVersionId,
          isLive: true,
          publishedAt: new Date(),
        },
      });
    } else {
      const slugRows = (await prisma.sitePublication.findMany({
        select: { slug: true },
      })) as Array<{ slug: string }>;
      const taken = new Set<string>(slugRows.map((row) => row.slug));
      const slug = pickSiteSlug(slugifySiteTitle(project.title), taken);
      publication = await prisma.sitePublication.create({
        data: {
          projectId: project.id,
          slug,
          versionId: project.currentVersionId,
          isLive: true,
        },
      });
    }
  } catch (error) {
    if (isMissingRelationError(error)) {
      throw new ClientError(PUBLISHING_SETUP_MESSAGE, 503, "not_configured");
    }
    throw error;
  }
  const updated = await prisma.siteProject.update({
    where: { id: project.id },
    data: { status: "published" },
  });
  const versionNumber = await publishedVersionNumber(publication);
  const conversationId = await builderConversationId(
    project.id,
    input.userId,
    project.workspaceId,
    updated.title,
  );
  await appendBuilderMessages(
    conversationId,
    "Publish my website",
    `Your website is live at ${publishedSiteUrl(publication.slug)} — version ${versionNumber ?? ""} is what visitors see now. Keep editing here whenever you like; the live site only changes when you publish again.`,
    "",
    0,
  );
  return {
    project: serializeSiteProject(updated),
    publication: serializePublication(
      publication,
      updated.currentVersionId,
      versionNumber,
    ),
  };
}

export async function unpublishSiteProject(input: {
  userId: string;
  projectId: string;
}) {
  const project = await loadOwnedProject(input.userId, input.projectId);
  let publication: PublicationRow | null;
  try {
    publication = await getPublicationSafe(project.id);
    if (publication) {
      publication = await prisma.sitePublication.update({
        where: { id: publication.id },
        data: { isLive: false },
      });
    }
  } catch (error) {
    if (isMissingRelationError(error)) {
      throw new ClientError(PUBLISHING_SETUP_MESSAGE, 503, "not_configured");
    }
    throw error;
  }
  const updated = await prisma.siteProject.update({
    where: { id: project.id },
    data: { status: "draft" },
  });
  return {
    project: serializeSiteProject(updated),
    publication: serializePublication(
      publication,
      updated.currentVersionId,
      await publishedVersionNumber(publication),
    ),
  };
}

/**
 * Public resolution for the published-site routes. Returns the pinned
 * version's HTML, or null when the slug is unknown, not live, or the
 * publication table is not in this database yet (fail-safe 404).
 */
export async function resolvePublishedSite(slug: string) {
  try {
    const publication = await prisma.sitePublication.findUnique({
      where: { slug },
      include: {
        project: { select: { id: true, title: true, template: true } },
        version: { select: { id: true, html: true, version: true } },
      },
    });
    if (!publication?.isLive || !publication.version) return null;
    const pages = await loadVersionPagesSafe(publication.version.id);
    const settings = await getSiteSettingsSafe(publication.projectId);
    return {
      projectId: publication.projectId,
      title: publication.project.title,
      template: publication.project.template,
      versionId: publication.version.id,
      version: publication.version.version,
      html: publication.version.html,
      pages,
      settings,
    };
  } catch {
    return null;
  }
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
  // Multi-page: a restore brings the source version's pages along too.
  const sourcePages = await loadVersionPagesSafe(source.id);
  const pagesSaved = await saveVersionPages(version.id, sourcePages);
  const restoredPages = pagesSaved ? sourcePages : [];
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
  const settings = await getSiteSettingsSafe(project.id);
  return {
    project: serializeSiteProject(updated),
    version: serializeSiteVersion(version),
    previewHtml: buildVersionPreviewHtml(
      version.html,
      restoredPages,
      whatsAppTransform(settings),
    ),
  };
}
