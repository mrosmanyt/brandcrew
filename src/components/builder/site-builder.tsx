"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  History,
  Loader2,
  Monitor,
  Plus,
  Rocket,
  RotateCcw,
  Send,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Website Builder (Package 11b): Lovable-style two-pane screen.
 * Left = the builder chat (a normal chat conversation tied to the
 * project). Right = the live preview of the current version inside a
 * sandboxed iframe (allow-scripts, NO allow-same-origin — the page's own
 * small inline interactivity runs, but it can never reach the app).
 * Every generation/edit lands as a new SiteVersion; Restore brings any
 * older version back. Publish (11d) pins the current version to the
 * project's free subdomain, served from inside the app; the live site
 * only changes when the owner publishes again.
 */

type SiteTemplate = {
  id: string;
  label: string;
  blurb: string;
  defaultTitle: string;
  starterPrompt: string;
  designDirection: string;
};

const COLOUR_CHOICES = [
  "Let CINEM choose",
  "Warm & rich",
  "Fresh & natural",
  "Deep blue & trustworthy",
  "Black & gold elegance",
  "Bright & friendly",
  "Soft pastel",
] as const;

type BuilderStatus = {
  configured: boolean;
  plan: string;
  projectCap: number;
  projectCount: number;
  canCreateProject: boolean;
  templates: SiteTemplate[];
};

type SitePublication = {
  slug: string;
  url: string;
  isLive: boolean;
  publishedVersionId: string | null;
  publishedVersion: number | null;
  liveIsCurrent: boolean;
  publishedAt: string;
  updatedAt: string;
};

type SiteProject = {
  id: string;
  title: string;
  template: string | null;
  status: string;
  currentVersionId: string | null;
  updatedAt: string;
  publication?: SitePublication | null;
};

type SiteVersion = {
  id: string;
  version: number;
  kind: string;
  instruction: string;
  tokens: number;
  createdAt: string;
};

type BuilderMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

type ProjectDetail = {
  project: SiteProject;
  publication: SitePublication | null;
  versions: SiteVersion[];
  currentVersionId: string | null;
  pages: Array<{ path: string; title: string }>;
  previewHtml: string | null;
  messages: BuilderMessage[];
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong. Try again.");
  }
  return data;
}

function versionTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function SiteBuilder({ userName }: { userName: string }) {
  const [status, setStatus] = useState<BuilderStatus | null>(null);
  const [projects, setProjects] = useState<SiteProject[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [showVersions, setShowVersions] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat");
  const [creating, setCreating] = useState(false);
  const [activePage, setActivePage] = useState("/");
  const scrollRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const gotoPage = useCallback((path: string) => {
    setActivePage(path);
    iframeRef.current?.contentWindow?.postMessage({ cinemGoto: path }, "*");
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const data = await api<ProjectDetail>(`/api/builder/projects/${id}`);
    setDetail(data);
    return data;
  }, []);

  const loadProjects = useCallback(async (selectId?: string) => {
    const data = await api<{ status: BuilderStatus; projects: SiteProject[] }>(
      "/api/builder/projects",
    );
    setStatus(data.status);
    setProjects(data.projects);
    const next = selectId ?? data.projects[0]?.id ?? null;
    setProjectId(next);
    if (next) {
      await loadDetail(next);
    } else {
      setDetail(null);
    }
  }, [loadDetail]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadProjects()
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load."))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProjects]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [detail?.messages.length, busy]);

  useEffect(() => {
    setActivePage("/");
  }, [detail?.currentVersionId]);

  const createProject = useCallback(
    async (template: SiteTemplate) => {
      setCreating(true);
      setError("");
      try {
        const result = await api<{ project: SiteProject }>(
          "/api/builder/projects",
          {
            method: "POST",
            body: JSON.stringify({ template: template.id }),
          },
        );
        await loadProjects(result.project.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create the website.");
      } finally {
        setCreating(false);
      }
    },
    [loadProjects],
  );

  const send = useCallback(
    async (override?: string) => {
      const instruction = (override ?? draft).trim();
      if (!instruction || !projectId || busy) return;
      setBusy(true);
      setError("");
      try {
        await api(`/api/builder/projects/${projectId}/generate`, {
          method: "POST",
          body: JSON.stringify({ instruction }),
        });
        setDraft("");
        await loadDetail(projectId);
        await loadProjects(projectId);
        setMobileTab("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "The build failed. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [draft, projectId, busy, loadDetail, loadProjects],
  );

  // Replit-style detail flow: after picking a template, collect the few
  // details that most change the result (business name, main colour,
  // WhatsApp/phone) and fold them into the first build — instead of
  // generating blind from the template brief alone.
  const [bizName, setBizName] = useState("");
  const [colour, setColour] = useState<string>(COLOUR_CHOICES[0]);
  const [contact, setContact] = useState("");

  const activeTemplate = (status?.templates ?? []).find(
    (row) => row.id === detail?.project.template,
  );
  const showDetailsCard =
    Boolean(projectId) &&
    Boolean(detail) &&
    (detail?.versions.length ?? 0) === 0 &&
    Boolean(activeTemplate) &&
    activeTemplate?.id !== "blank";

  const buildWithDetails = useCallback(() => {
    if (!activeTemplate) return;
    const lines: string[] = [activeTemplate.starterPrompt];
    const details: string[] = [];
    if (bizName.trim()) details.push(`Business name: ${bizName.trim()}.`);
    if (colour !== COLOUR_CHOICES[0]) details.push(`Main colour feel: ${colour}.`);
    if (contact.trim()) {
      const digits = contact.replace(/[^0-9]/g, "");
      details.push(
        `Contact number: ${contact.trim()} — use tel:${contact.trim()} for tap-to-call and https://wa.me/${digits} for every WhatsApp button.`,
      );
    }
    if (details.length) lines.push(`Details from the owner: ${details.join(" ")}`);
    void send(lines.join("\n\n"));
  }, [activeTemplate, bizName, colour, contact, send]);

  const [publishing, setPublishing] = useState(false);

  const publish = useCallback(
    async (live: boolean) => {
      if (!projectId || publishing) return;
      setPublishing(true);
      setError("");
      try {
        await api(`/api/builder/projects/${projectId}/publish`, {
          method: live ? "POST" : "DELETE",
        });
        await loadDetail(projectId);
        await loadProjects(projectId);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Publishing failed. Try again.",
        );
      } finally {
        setPublishing(false);
      }
    },
    [projectId, publishing, loadDetail, loadProjects],
  );

  const restore = useCallback(
    async (versionId: string) => {
      if (!projectId || busy) return;
      setBusy(true);
      setError("");
      try {
        await api(`/api/builder/projects/${projectId}/restore`, {
          method: "POST",
          body: JSON.stringify({ versionId }),
        });
        await loadDetail(projectId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Restore failed. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [projectId, busy, loadDetail],
  );

  const configured = status?.configured ?? true;
  const hasVersions = (detail?.versions.length ?? 0) > 0;
  const templates = status?.templates ?? [];

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Chat
          </Link>
          <h1 className="flex items-center gap-2 text-[15px] font-semibold">
            <Globe className="size-4" /> Website Builder
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {status ? (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {status.projectCount} of {status.projectCap} websites · {status.plan} plan
            </span>
          ) : null}
          <select
            aria-label="Choose a website"
            className="max-w-44 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={projectId ?? ""}
            onChange={(event) => {
              const id = event.target.value || null;
              setProjectId(id);
              setError("");
              if (id) {
                loadDetail(id).catch((err) =>
                  setError(err instanceof Error ? err.message : "Failed to load."),
                );
              } else {
                setDetail(null);
              }
            }}
          >
            <option value="">New website…</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </div>
      </header>

      {!configured && !loading ? (
        <div className="shrink-0 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm">
          Website generation isn&apos;t configured yet — the builder opens and
          your saved websites and versions still work, and generation starts
          as soon as a provider key is added. Nothing here is a demo or a
          placeholder site.
        </div>
      ) : null}

      {error ? (
        <div className="shrink-0 border-b border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* Mobile tabs */}
      <div className="flex shrink-0 border-b border-border lg:hidden">
        {(["chat", "preview"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className={cn(
              "flex-1 py-2 text-sm capitalize",
              mobileTab === tab
                ? "font-semibold text-foreground"
                : "text-muted-foreground",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Chat pane */}
        <section
          className={cn(
            "flex min-h-0 w-full flex-col border-r border-border lg:w-[380px] lg:shrink-0",
            mobileTab === "preview" && "hidden lg:flex",
          )}
        >
          {loading ? (
            <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading the builder…
            </p>
          ) : !projectId ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <h2 className="text-sm font-semibold">Start a website</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Pick a starting point — nobody has to face a blank page. You
                can change everything afterwards just by asking.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    disabled={creating || status?.canCreateProject === false}
                    onClick={() => createProject(template)}
                    className="rounded-lg border border-border p-3 text-left transition hover:bg-muted disabled:opacity-50"
                  >
                    <span className="flex items-center justify-between text-sm font-medium">
                      {template.label}
                      {creating ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Plus className="size-4 text-muted-foreground" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {template.blurb}
                    </span>
                  </button>
                ))}
              </div>
              {status?.canCreateProject === false ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  You&apos;ve used all {status.projectCap} websites on your
                  plan. Upgrade to build more.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
                {(detail?.messages ?? []).length === 0 ? (
                  <div className="text-sm leading-6 text-muted-foreground">
                    <p className="font-medium text-foreground">
                      Hi {userName.split(" ")[0]} — describe your website below.
                    </p>
                    <p className="mt-2">
                      Say who it&apos;s for, what it should show, and the feel
                      you want. I&apos;ll build the whole page, then you can
                      ask for changes the same way.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {(detail?.messages ?? []).map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "max-w-[92%] rounded-lg px-3 py-2 text-sm leading-6 whitespace-pre-wrap",
                          message.role === "user"
                            ? "self-end bg-primary text-primary-foreground"
                            : "self-start bg-muted",
                        )}
                      >
                        {message.content}
                      </div>
                    ))}
                    {busy ? (
                      <p className="flex items-center gap-2 self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" /> Building
                        your website…
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
              {showDetailsCard && activeTemplate ? (
                <div className="shrink-0 border-t border-border bg-muted/40 p-3">
                  <p className="text-sm font-medium">
                    Before I build your {activeTemplate.label.toLowerCase()} site —
                    three quick details
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    These change the result more than anything else. Skip any
                    you like.
                  </p>
                  <div className="mt-2.5 flex flex-col gap-2">
                    <input
                      value={bizName}
                      onChange={(event) => setBizName(event.target.value)}
                      placeholder="Business name — e.g. Green Leaf Salon"
                      className="rounded-md border border-border bg-background px-2.5 py-2 text-sm"
                    />
                    <select
                      value={colour}
                      onChange={(event) => setColour(event.target.value)}
                      className="rounded-md border border-border bg-background px-2.5 py-2 text-sm"
                      aria-label="Main colour"
                    >
                      {COLOUR_CHOICES.map((choice) => (
                        <option key={choice} value={choice}>
                          {choice === COLOUR_CHOICES[0]
                            ? "Main colour — let CINEM choose"
                            : `Main colour — ${choice}`}
                        </option>
                      ))}
                    </select>
                    <input
                      value={contact}
                      onChange={(event) => setContact(event.target.value)}
                      placeholder="WhatsApp / phone — for booking & call buttons"
                      className="rounded-md border border-border bg-background px-2.5 py-2 text-sm"
                    />
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={buildWithDetails}
                      disabled={!configured || busy}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      Build my website
                    </Button>
                    <button
                      type="button"
                      disabled={!configured || busy}
                      onClick={() => void send(activeTemplate.starterPrompt)}
                      className="text-sm text-muted-foreground underline-offset-2 transition hover:text-foreground disabled:opacity-50"
                    >
                      Skip — just build it
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="shrink-0 border-t border-border p-3">
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={
                    hasVersions
                      ? "Ask for a change — “make the top dark green, add prices…”"
                      : "Describe your website…"
                  }
                  rows={3}
                  disabled={!configured || busy}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {hasVersions
                      ? "Each change is saved as a new version."
                      : "Your first build is saved as version 1."}
                  </span>
                  <Button
                    type="button"
                    onClick={() => void send()}
                    disabled={!configured || busy || draft.trim().length < 3}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    {hasVersions ? "Apply change" : "Build my website"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Preview pane */}
        <section
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            mobileTab === "chat" && "hidden lg:flex",
          )}
        >
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Desktop preview"
                onClick={() => setDevice("desktop")}
                className={cn(
                  "rounded-md p-1.5",
                  device === "desktop"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground",
                )}
              >
                <Monitor className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Phone preview"
                onClick={() => setDevice("phone")}
                className={cn(
                  "rounded-md p-1.5",
                  device === "phone"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground",
                )}
              >
                <Smartphone className="size-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {hasVersions && detail?.publication?.isLive ? (
                <>
                  <a
                    href={`/sites/${detail.publication.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hidden items-center gap-1 text-xs font-medium text-emerald-600 hover:underline sm:inline-flex"
                    title={detail.publication.url}
                  >
                    Live · {detail.publication.slug}.cinem.tech
                    <ExternalLink className="size-3" />
                  </a>
                  {!detail.publication.liveIsCurrent ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={publishing}
                      onClick={() => void publish(true)}
                    >
                      {publishing ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Rocket className="size-3.5" />
                      )}
                      Update live site
                    </Button>
                  ) : null}
                  <button
                    type="button"
                    disabled={publishing}
                    onClick={() => void publish(false)}
                    className="text-xs text-muted-foreground underline-offset-2 transition hover:text-foreground disabled:opacity-50"
                  >
                    Unpublish
                  </button>
                </>
              ) : hasVersions ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={publishing}
                  onClick={() => void publish(true)}
                >
                  {publishing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Rocket className="size-3.5" />
                  )}
                  Publish
                </Button>
              ) : (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  Build a version, then publish it live
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowVersions((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <History className="size-4" /> Versions
              {detail ? ` (${detail.versions.length})` : ""}
            </button>
          </div>

          {(detail?.pages.length ?? 0) > 1 ? (
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
              <span className="text-xs text-muted-foreground">Pages:</span>
              {detail!.pages.map((page) => (
                <button
                  key={page.path}
                  type="button"
                  onClick={() => gotoPage(page.path)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition",
                    activePage === page.path
                      ? "border-primary/60 bg-primary/10 font-medium text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {page.title}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1">
            <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto bg-muted/40 p-3">
              {detail?.previewHtml ? (
                <iframe
                  ref={iframeRef}
                  key={detail.currentVersionId ?? "preview"}
                  title={detail.project.title}
                  srcDoc={detail.previewHtml}
                  sandbox="allow-scripts"
                  className={cn(
                    "h-full rounded-md border border-border bg-white shadow-sm",
                    device === "phone" ? "w-[390px] max-w-full" : "w-full",
                  )}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center text-center">
                  <Sparkles className="size-6 text-muted-foreground" />
                  <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                    {projectId
                      ? "No version yet — describe your website in the chat and it will appear here, live."
                      : "Pick a template on the left to start your first website."}
                  </p>
                </div>
              )}
            </div>

            {showVersions ? (
              <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-l border-border p-3">
                <h3 className="text-sm font-semibold">Versions</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Every build and change is saved. Restore brings an older
                  version back — as a new version, so nothing is ever lost.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {(detail?.versions ?? []).map((version) => {
                    const isCurrent = version.id === detail?.currentVersionId;
                    return (
                      <div
                        key={version.id}
                        className={cn(
                          "rounded-lg border p-2.5",
                          isCurrent ? "border-primary/50" : "border-border",
                        )}
                      >
                        <p className="text-sm font-medium">
                          Version {version.version}
                          {isCurrent ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              current
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {version.instruction || version.kind}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {versionTime(version.createdAt)}
                        </p>
                        {!isCurrent ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            disabled={busy}
                            onClick={() => void restore(version.id)}
                          >
                            <RotateCcw className="size-3.5" /> Restore
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                  {(detail?.versions ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No versions yet.
                    </p>
                  ) : null}
                </div>
              </aside>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
