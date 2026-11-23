"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  History,
  ImagePlus,
  Loader2,
  MessageCircle,
  Monitor,
  Plus,
  Rocket,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Trash2,
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

type SiteProduct = {
  name: string;
  price: string;
  imageAssetId?: string;
  note?: string;
};

type SiteSettings = {
  whatsappNumber: string | null;
  whatsappEnabled: boolean;
  language: string;
  products: SiteProduct[];
  metaTitle: string | null;
  metaDescription: string | null;
  whatsappLink: string | null;
};

const SITE_LANGUAGE_OPTIONS = [
  { id: "en", label: "English" },
  { id: "ur", label: "Urdu — اردو" },
  { id: "roman-ur", label: "Roman Urdu" },
  { id: "mixed", label: "Mixed — English + Urdu" },
] as const;

type SiteAsset = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
};

type ProjectDetail = {
  project: SiteProject;
  publication: SitePublication | null;
  settings: SiteSettings;
  assets: SiteAsset[];
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
  const [showAssets, setShowAssets] = useState(false);
  const [uploading, setUploading] = useState(false);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [waNumber, setWaNumber] = useState("");
  const [waEnabled, setWaEnabled] = useState(true);
  const [siteLang, setSiteLang] = useState<string>("en");
  const [productsDraft, setProductsDraft] = useState<SiteProduct[]>([]);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
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
    setWaNumber(data.settings?.whatsappNumber ?? "");
    setWaEnabled(data.settings?.whatsappEnabled ?? true);
    setSiteLang(data.settings?.language ?? "en");
    setProductsDraft(data.settings?.products ?? []);
    setMetaTitle(data.settings?.metaTitle ?? "");
    setMetaDescription(data.settings?.metaDescription ?? "");
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
  const [detailsLang, setDetailsLang] = useState<string>("en");

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
      // Save it as the site's WhatsApp number (Package D) so the
      // floating button + every later build use exactly this number.
      // Best-effort: the prompt above already carries the number.
      if (projectId) {
        void api(`/api/builder/projects/${projectId}/settings`, {
          method: "PATCH",
          body: JSON.stringify({ whatsappNumber: digits }),
        }).catch(() => undefined);
      }
    }
    if (detailsLang !== "en" && projectId) {
      // Persist the site language (Package E) so every later build and
      // edit keeps it; the language block in generation does the rest.
      void api(`/api/builder/projects/${projectId}/settings`, {
        method: "PATCH",
        body: JSON.stringify({ language: detailsLang }),
      }).catch(() => undefined);
    }
    if (details.length) lines.push(`Details from the owner: ${details.join(" ")}`);
    void send(lines.join("\n\n"));
  }, [activeTemplate, bizName, colour, contact, detailsLang, send, projectId]);

  const uploadAsset = useCallback(
    async (file: File) => {
      if (!projectId || uploading) return;
      setUploading(true);
      setError("");
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Could not read that file."));
          reader.readAsDataURL(file);
        });
        const base64 = dataUrl.split(",")[1] ?? "";
        await api(`/api/builder/projects/${projectId}/assets`, {
          method: "POST",
          body: JSON.stringify({
            name: file.name,
            mimeType: file.type,
            dataBase64: base64,
          }),
        });
        await loadDetail(projectId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed. Try again.");
      } finally {
        setUploading(false);
      }
    },
    [projectId, uploading, loadDetail],
  );

  const deleteAsset = useCallback(
    async (assetId: string) => {
      if (!projectId || busy) return;
      setError("");
      try {
        await api(`/api/builder/assets/${assetId}`, { method: "DELETE" });
        await loadDetail(projectId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed. Try again.");
      }
    },
    [projectId, busy, loadDetail],
  );

  const saveSettings = useCallback(async () => {
    if (!projectId || savingSettings) return;
    setSavingSettings(true);
    setError("");
    try {
      await api(`/api/builder/projects/${projectId}/settings`, {
        method: "PATCH",
        body: JSON.stringify({
          whatsappNumber: waNumber.trim() === "" ? null : waNumber.trim(),
          whatsappEnabled: waEnabled,
          language: siteLang,
          products: productsDraft
            .filter((product) => product.name.trim() !== "")
            .map((product) => ({
              name: product.name.trim(),
              price: product.price.trim(),
              imageAssetId: product.imageAssetId || undefined,
              note: product.note?.trim() ? product.note.trim() : undefined,
            })),
          metaTitle: metaTitle.trim() === "" ? null : metaTitle.trim(),
          metaDescription:
            metaDescription.trim() === "" ? null : metaDescription.trim(),
        }),
      });
      await loadDetail(projectId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Saving settings failed.",
      );
    } finally {
      setSavingSettings(false);
    }
  }, [
    projectId,
    savingSettings,
    waNumber,
    waEnabled,
    siteLang,
    productsDraft,
    metaTitle,
    metaDescription,
    loadDetail,
  ]);

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
                    a few quick details
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
                    <select
                      value={detailsLang}
                      onChange={(event) => setDetailsLang(event.target.value)}
                      className="rounded-md border border-border bg-background px-2.5 py-2 text-sm"
                      aria-label="Site language"
                    >
                      {SITE_LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {`Site language — ${option.label}`}
                        </option>
                      ))}
                    </select>
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
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setShowAssets((value) => !value);
                  setShowVersions(false);
                  setShowSettings(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <ImagePlus className="size-4" /> Photos
                {detail ? ` (${detail.assets.length})` : ""}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowVersions((value) => !value);
                  setShowAssets(false);
                  setShowSettings(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <History className="size-4" /> Versions
                {detail ? ` (${detail.versions.length})` : ""}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSettings((value) => !value);
                  setShowAssets(false);
                  setShowVersions(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <SlidersHorizontal className="size-4" /> Settings
              </button>
            </div>
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

            {showAssets ? (
              <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-l border-border p-3">
                <h3 className="text-sm font-semibold">Photos &amp; logo</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Upload your logo and photos, then mention them in the
                  chat — “use my logo in the header”, “put the shop photo
                  on the home page”. JPG, PNG, WebP or GIF, up to 3.5 MB
                  each.
                </p>
                <input
                  ref={assetInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void uploadAsset(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled={uploading || !projectId}
                  onClick={() => assetInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="size-3.5" />
                  )}
                  Upload a photo
                </Button>
                <div className="mt-3 flex flex-col gap-2">
                  {(detail?.assets ?? []).map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center gap-2 rounded-lg border border-border p-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="size-10 shrink-0 rounded object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {asset.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {Math.max(1, Math.round(asset.sizeBytes / 1024))} KB
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Delete ${asset.name}`}
                        disabled={busy}
                        onClick={() => void deleteAsset(asset.id)}
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-destructive disabled:opacity-50"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  {(detail?.assets ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No photos yet.
                    </p>
                  ) : null}
                </div>
              </aside>
            ) : null}

            {showSettings ? (
              <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-l border-border p-3">
                <h3 className="text-sm font-semibold">Site settings</h3>
                <div className="mt-3">
                  <p className="inline-flex items-center gap-1.5 text-sm font-medium">
                    <MessageCircle className="size-4" /> WhatsApp button
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    A floating WhatsApp button on your site so customers
                    can message and order. Changes apply to the live site
                    right away — or just say “WhatsApp button hata do /
                    laga do” in the chat.
                  </p>
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={waEnabled}
                      onChange={(event) => setWaEnabled(event.target.checked)}
                      className="size-4 accent-primary"
                    />
                    Show the WhatsApp button
                  </label>
                  <label className="mt-3 block text-xs font-medium text-muted-foreground">
                    WhatsApp number (with country code)
                    <input
                      value={waNumber}
                      onChange={(event) => setWaNumber(event.target.value)}
                      placeholder="92 300 1234567"
                      inputMode="tel"
                      className="mt-1 w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground outline-none transition focus:border-ring"
                    />
                  </label>
                </div>
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-sm font-medium">Site language</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    The language your website itself is written in. You
                    can describe changes in any language — Urdu, Roman
                    Urdu or English.
                  </p>
                  <select
                    value={siteLang}
                    onChange={(event) => setSiteLang(event.target.value)}
                    className="mt-2 w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground outline-none transition focus:border-ring"
                  >
                    {SITE_LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3"
                    disabled={savingSettings || !projectId}
                    onClick={() => void saveSettings()}
                  >
                    {savingSettings ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    Save settings
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    After saving, ask in the chat for a rebuild (e.g.
                    “site ko isi language mein dobara banao”) to rewrite
                    the current pages.
                  </p>
                </div>
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-sm font-medium">Products (for shops)</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Your real products — name, price and a photo from the
                    Photos panel. Each product gets its own WhatsApp
                    order button; orders come straight to your WhatsApp.
                    Save, then ask in the chat: “products wala grid dobara
                    banao”.
                  </p>
                  <div className="mt-3 flex flex-col gap-3">
                    {productsDraft.map((product, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-border p-2"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            value={product.name}
                            onChange={(event) =>
                              setProductsDraft((rows) =>
                                rows.map((row, i) =>
                                  i === index
                                    ? { ...row, name: event.target.value }
                                    : row,
                                ),
                              )
                            }
                            placeholder="Product name"
                            className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
                          />
                          <button
                            type="button"
                            aria-label="Remove product"
                            onClick={() =>
                              setProductsDraft((rows) =>
                                rows.filter((_, i) => i !== index),
                              )
                            }
                            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        <input
                          value={product.price}
                          onChange={(event) =>
                            setProductsDraft((rows) =>
                              rows.map((row, i) =>
                                i === index
                                  ? { ...row, price: event.target.value }
                                  : row,
                              ),
                            )
                          }
                          placeholder="Price — e.g. Rs 1,499"
                          className="mt-2 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
                        />
                        <select
                          value={product.imageAssetId ?? ""}
                          onChange={(event) =>
                            setProductsDraft((rows) =>
                              rows.map((row, i) =>
                                i === index
                                  ? {
                                      ...row,
                                      imageAssetId:
                                        event.target.value || undefined,
                                    }
                                  : row,
                              ),
                            )
                          }
                          className="mt-2 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
                        >
                          <option value="">Photo — none</option>
                          {(detail?.assets ?? []).map((asset) => (
                            <option key={asset.id} value={asset.id}>
                              {`Photo — ${asset.name}`}
                            </option>
                          ))}
                        </select>
                        <input
                          value={product.note ?? ""}
                          onChange={(event) =>
                            setProductsDraft((rows) =>
                              rows.map((row, i) =>
                                i === index
                                  ? { ...row, note: event.target.value }
                                  : row,
                              ),
                            )
                          }
                          placeholder="Note (optional) — e.g. Free delivery"
                          className="mt-2 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={productsDraft.length >= 30}
                      onClick={() =>
                        setProductsDraft((rows) => [
                          ...rows,
                          { name: "", price: "" },
                        ])
                      }
                    >
                      <Plus className="size-3.5" /> Add product
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={savingSettings || !projectId}
                      onClick={() => void saveSettings()}
                    >
                      {savingSettings ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : null}
                      Save settings
                    </Button>
                  </div>
                </div>
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-sm font-medium">Google / SEO</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    How your site appears in Google search. Leave blank —
                    we generate these from your site automatically. Your
                    published site is also added to the sitemap on its
                    own.
                  </p>
                  <label className="mt-3 block text-xs font-medium text-muted-foreground">
                    Search title (max 70 characters)
                    <input
                      value={metaTitle}
                      onChange={(event) => setMetaTitle(event.target.value)}
                      maxLength={70}
                      placeholder="e.g. Green Leaf Salon — Best Haircuts in Lahore"
                      className="mt-1 w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground outline-none transition focus:border-ring"
                    />
                  </label>
                  <label className="mt-3 block text-xs font-medium text-muted-foreground">
                    Search description (max 200 characters)
                    <textarea
                      value={metaDescription}
                      onChange={(event) =>
                        setMetaDescription(event.target.value)
                      }
                      maxLength={200}
                      rows={3}
                      placeholder="One or two lines a customer sees under your title in Google."
                      className="mt-1 w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground outline-none transition focus:border-ring"
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3"
                    disabled={savingSettings || !projectId}
                    onClick={() => void saveSettings()}
                  >
                    {savingSettings ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    Save settings
                  </Button>
                </div>
              </aside>
            ) : null}

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
