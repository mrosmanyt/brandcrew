import type { JobDTO, JobEventDTO } from "@/lib/job-types";
import type { MessageDTO } from "@/lib/types";

export type LiveProgressTone = "info" | "success" | "wait" | "error" | "working";

export type LiveProgressLine = {
  id: string;
  tone: LiveProgressTone;
  label: string;
  detail?: string;
  url?: string;
  createdAt: string;
};

export type ChatThreadItem =
  | { kind: "message"; id: string; at: number; message: MessageDTO }
  | { kind: "progress"; id: string; at: number; line: LiveProgressLine };

const TOOL_NOW: Record<string, string> = {
  read_brand_kit: "Now reading Brand Kit…",
  fetch_url: "Opening URL…",
  web_search: "Searching the web…",
  browser_navigate: "Opening URL…",
  browser_snapshot: "Capturing page snapshot…",
  browser_click: "Clicking on the page…",
  browser_type: "Typing on the page…",
  crawl_links: "Crawling links…",
  read_artifact: "Reading a previous draft…",
  gmail_list_recent: "Checking Gmail…",
  gmail_create_draft: "Drafting an email…",
  slack_list_channels: "Listing Slack channels…",
  slack_draft_message: "Drafting a Slack message…",
  slack_post_message: "Posting to Slack…",
  write_artifact: "Writing draft…",
  ask_user: "Waiting for your approval…",
};

function hostFromUrl(url?: string) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] || url;
  }
}

function eventUrl(event: JobEventDTO) {
  return typeof event.data?.url === "string" && event.data.url
    ? event.data.url
    : undefined;
}

function eventTool(event: JobEventDTO) {
  return typeof event.data?.tool === "string" ? event.data.tool : "";
}

function doneLabel(tool: string, message: string, url?: string): string {
  const host = hostFromUrl(url);
  switch (tool) {
    case "read_brand_kit":
      return "Read the Brand Kit.";
    case "fetch_url":
    case "browser_navigate":
      return host ? `Opened ${host}.` : "Opened URL.";
    case "browser_snapshot":
      return host ? `Captured snapshot of ${host}.` : "Captured page snapshot.";
    case "crawl_links":
      return "Crawled public links.";
    case "web_search":
      return "Finished web search.";
    case "write_artifact":
      return /website|html|app/i.test(message) ? "Wrote preview." : "Wrote draft.";
    case "read_artifact":
      return "Read a previous draft.";
    case "gmail_list_recent":
      return "Checked Gmail.";
    case "gmail_create_draft":
      return "Drafted an email.";
    case "slack_list_channels":
      return "Listed Slack channels.";
    case "slack_draft_message":
      return "Drafted a Slack message.";
    case "slack_post_message":
      return "Posted to Slack.";
    case "ask_user":
      return "Waiting for your approval…";
    default:
      return friendlyRaw(message);
  }
}

function friendlyRaw(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "Working…";
  if (/^Plan ready/i.test(trimmed)) {
    const count = trimmed.match(/(\d+)\s+steps/i)?.[1];
    return count ? `Planned ${count} steps.` : "Plan ready.";
  }
  if (/queued /i.test(trimmed)) return trimmed.replace(/\.$/, "") + ".";
  if (/^Job finished/i.test(trimmed)) return "Job finished.";
  if (/Approval received/i.test(trimmed)) return "Approval received — continuing.";
  if (/artifacts approved/i.test(trimmed)) return trimmed;
  if (/Job complete/i.test(trimmed)) return "All artifacts approved. Job complete.";
  if (/^browser_navigate|^fetch_url|^browser_snapshot|^browser_click|^browser_type|^crawl_links|^web_search|^write_artifact|^read_/i.test(trimmed)) {
    const url = trimmed.match(/https?:\/\/\S+/)?.[0];
    const tool = trimmed.split(/\s+/)[0];
    return doneLabel(tool, trimmed, url);
  }
  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}…` : trimmed;
}

function toneForType(type: string, tool?: string): LiveProgressTone {
  if (type === "error") return "error";
  if (type === "ask_user" || tool === "ask_user") return "wait";
  if (type === "step_start" || type === "created" || type === "tool_call") {
    return type === "created" ? "info" : "working";
  }
  if (type === "tool_result" || type === "status" || type === "plan") return "success";
  return "info";
}

function createdAtMs(value: string | Date | undefined) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Turn raw job events into short chat-status lines.
 * tool_call noise is dropped when a step already has a friendlier start/result.
 */
export function liveProgressFromEvents(events: JobEventDTO[]): LiveProgressLine[] {
  const byStep = new Map<string, LiveProgressLine>();
  const standalone: LiveProgressLine[] = [];
  const order: string[] = [];

  const put = (key: string, line: LiveProgressLine) => {
    if (!byStep.has(key)) order.push(key);
    byStep.set(key, line);
  };

  for (const event of events) {
    const tool = eventTool(event);
    const url = eventUrl(event);
    const stepKey = event.stepId || `${event.type}:${event.id}`;

    if (event.type === "tool_call") {
      const existing = byStep.get(stepKey);
      if (existing) {
        if (url && !existing.url) {
          byStep.set(stepKey, { ...existing, url, detail: existing.detail || hostFromUrl(url) });
        }
        continue;
      }
    }

    if (event.type === "created") {
      standalone.push({
        id: event.id,
        tone: "info",
        label: friendlyRaw(event.message),
        createdAt: String(event.createdAt),
      });
      continue;
    }

    if (event.type === "plan") {
      standalone.push({
        id: event.id,
        tone: "success",
        label: friendlyRaw(event.message),
        createdAt: String(event.createdAt),
      });
      continue;
    }

    if (event.type === "status") {
      standalone.push({
        id: event.id,
        tone: "success",
        label: friendlyRaw(event.message),
        createdAt: String(event.createdAt),
      });
      continue;
    }

    if (event.type === "error") {
      standalone.push({
        id: event.id,
        tone: "error",
        label: event.message || "Something went wrong.",
        createdAt: String(event.createdAt),
      });
      continue;
    }

    if (event.type === "step_start") {
      put(stepKey, {
        id: event.id,
        tone: "working",
        label: TOOL_NOW[tool] || (event.message ? `${event.message}…` : "Working…"),
        url,
        detail: hostFromUrl(url) || undefined,
        createdAt: String(event.createdAt),
      });
      continue;
    }

    if (event.type === "ask_user") {
      put(stepKey, {
        id: event.id,
        tone: "wait",
        label: "Waiting for your approval…",
        detail: event.message && event.message !== "Pause for your approval"
          ? event.message
          : undefined,
        createdAt: String(event.createdAt),
      });
      continue;
    }

    if (event.type === "tool_result") {
      put(stepKey, {
        id: event.id,
        tone: "success",
        label: doneLabel(tool, event.message, url),
        url,
        detail: hostFromUrl(url) || undefined,
        createdAt: String(event.createdAt),
      });
    }
  }

  const stepped = order.map((key) => byStep.get(key)!).filter(Boolean);
  return [...standalone, ...stepped].sort(
    (a, b) => createdAtMs(a.createdAt) - createdAtMs(b.createdAt),
  );
}

export function currentLiveHeadline(job: JobDTO | null): {
  headline: string;
  detail?: string;
  tone: LiveProgressTone;
} {
  if (!job) {
    return { headline: "No live job", detail: "Start a job to stream results here.", tone: "info" };
  }
  if (job.status === "needs_you") {
    return {
      headline: "Waiting for your approval…",
      detail: job.askPrompt || job.title,
      tone: "wait",
    };
  }
  if (job.status === "failed") {
    return { headline: "Job failed", detail: job.error || "See the timeline.", tone: "error" };
  }
  if (job.status === "done") {
    return { headline: "Job finished.", detail: job.title, tone: "success" };
  }
  if (job.status === "queued") {
    return { headline: "Queued…", detail: job.title, tone: "working" };
  }
  const lines = liveProgressFromEvents(job.events || []);
  const latest = [...lines].reverse().find((line) => line.tone === "working") || lines.at(-1);
  return {
    headline: latest?.label || "Working…",
    detail: latest?.detail || job.title,
    tone: latest?.tone || "working",
  };
}

export function buildChatThread(
  messages: MessageDTO[],
  events: JobEventDTO[],
): ChatThreadItem[] {
  const progress = liveProgressFromEvents(events);
  const items: ChatThreadItem[] = [
    ...messages.map((message) => ({
      kind: "message" as const,
      id: `m-${message.id}`,
      at: createdAtMs(message.createdAt),
      message,
    })),
    ...progress.map((line) => ({
      kind: "progress" as const,
      id: `p-${line.id}`,
      at: createdAtMs(line.createdAt),
      line,
    })),
  ];
  return items.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

export function eventTypeLabel(type: string) {
  const labels: Record<string, string> = {
    created: "queued",
    plan: "plan",
    step_start: "step",
    tool_call: "tool",
    tool_result: "result",
    ask_user: "needs you",
    status: "status",
    error: "error",
  };
  return labels[type] ?? type.replaceAll("_", " ");
}

export function jobStatusLabel(status: string) {
  if (status === "needs_you") return "needs you";
  return status.replaceAll("_", " ");
}
