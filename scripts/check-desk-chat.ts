/**
 * Chat thread + live-progress + pane clamp guards. No database.
 */
import assert from "node:assert/strict";
import { clampPaneWidth, isStoredCollapsed, readStoredPaneWidth } from "../src/lib/desk-layout";
import type { JobDTO, JobEventDTO } from "../src/lib/job-types";
import {
  buildChatThread,
  currentLiveHeadline,
  liveProgressFromEvents,
} from "../src/lib/live-progress";
import type { MessageDTO } from "../src/lib/types";
import { decideDeskQa } from "../src/lib/desk-qa-pure";
import { JOB_ACTION_MESSAGES } from "../src/lib/constants";

function event(
  partial: Partial<JobEventDTO> & Pick<JobEventDTO, "id" | "type" | "message">,
): JobEventDTO {
  return {
    stepId: null,
    data: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

const events: JobEventDTO[] = [
  event({ id: "e1", type: "created", message: "New Agent queued LinkedIn week." }),
  event({
    id: "e2",
    type: "plan",
    message: "Plan ready — 5 steps.",
    createdAt: "2026-01-01T00:00:01.000Z",
  }),
  event({
    id: "e3",
    type: "step_start",
    message: "Read the Brand Kit",
    stepId: "s1",
    data: { tool: "read_brand_kit" },
    createdAt: "2026-01-01T00:00:02.000Z",
  }),
  event({
    id: "e4",
    type: "tool_call",
    message: "read_brand_kit",
    stepId: "s1",
    data: { tool: "read_brand_kit" },
    createdAt: "2026-01-01T00:00:03.000Z",
  }),
  event({
    id: "e5",
    type: "tool_result",
    message: "Read Brand Kit (voice, audience, offer).",
    stepId: "s1",
    data: { tool: "read_brand_kit" },
    createdAt: "2026-01-01T00:00:04.000Z",
  }),
  event({
    id: "e6",
    type: "step_start",
    message: "Open the site",
    stepId: "s2",
    data: { tool: "browser_navigate" },
    createdAt: "2026-01-01T00:00:05.000Z",
  }),
  event({
    id: "e7",
    type: "tool_call",
    message: "browser_navigate https://northline.example",
    stepId: "s2",
    data: { tool: "browser_navigate", url: "https://northline.example/about" },
    createdAt: "2026-01-01T00:00:06.000Z",
  }),
  event({
    id: "e8",
    type: "tool_result",
    message: "browser_navigate https://northline.example/about (fetch)",
    stepId: "s2",
    data: { tool: "browser_navigate", url: "https://northline.example/about" },
    createdAt: "2026-01-01T00:00:07.000Z",
  }),
  event({
    id: "e9",
    type: "tool_result",
    message: "Wrote five posts.",
    stepId: "s3",
    data: { tool: "write_artifact" },
    createdAt: "2026-01-01T00:00:08.000Z",
  }),
  event({
    id: "e9b",
    type: "tool_result",
    message: "Wrote another post.",
    stepId: "s3b",
    data: { tool: "write_artifact" },
    createdAt: "2026-01-01T00:00:08.500Z",
  }),
  event({
    id: "e10",
    type: "ask_user",
    message: "Pause for your approval",
    stepId: "s4",
    data: { tool: "ask_user" },
    createdAt: "2026-01-01T00:00:09.000Z",
  }),
];

const lines = liveProgressFromEvents(events);
const labels = lines.map((line) => line.label);
assert.equal(labels.includes("New Agent queued LinkedIn week."), true);
assert.equal(labels.includes("Planned 5 steps."), true);
assert.equal(labels.includes("Read the Brand Kit."), true);
assert.equal(labels.some((label) => /Opened northline\.example/.test(label)), true);
assert.equal(labels.includes("Wrote draft."), true);
assert.equal(labels.filter((label) => label === "Wrote draft.").length, 1);
assert.equal(labels.includes("Waiting for your approval…"), true);
assert.equal(labels.some((label) => label.startsWith("browser_navigate")), false);
assert.equal(labels.filter((label) => label === "Now reading Brand Kit…").length, 0);
console.log("ok: live progress uses chat-status language, not raw tool_call lines");

const midJob: JobDTO = {
  id: "job-1",
  workspaceId: "ws",
  agentId: "a1",
  agentRole: "writer",
  title: "LinkedIn week",
  prompt: "week",
  status: "running",
  plan: [],
  playbookKey: "linkedin_week",
  skillId: null,
  askPrompt: "",
  askKind: "",
  userAnswer: "",
  askChoices: [],
  error: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:05.000Z",
  events: events.slice(0, 6),
  artifacts: [],
};
const runningNow = currentLiveHeadline(midJob);
assert.match(runningNow.headline, /Opening URL|Working/);
assert.equal(runningNow.tone === "working" || runningNow.tone === "info", true);

const waiting = currentLiveHeadline({
  ...midJob,
  status: "needs_you",
  askPrompt: "Approve this draft before it leaves the desk.",
  events,
});
assert.equal(waiting.headline, "Waiting for your approval…");
assert.equal(waiting.tone, "wait");
console.log("ok: Live results headline follows job status");

const messages: MessageDTO[] = [
  {
    id: "m1",
    role: "user",
    content: "Write a LinkedIn-week job.",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "m2",
    role: "assistant",
    content: "New Agent started **LinkedIn week**.",
    createdAt: "2026-01-01T00:00:00.200Z",
  },
];
const thread = buildChatThread(messages, events);
assert.equal(thread[0]?.kind, "message");
assert.equal(thread.some((item) => item.kind === "progress"), true);
assert.equal(
  thread.filter((item) => item.kind === "message").length,
  2,
);
console.log("ok: chat thread interleaves bubbles and live status");

assert.equal(clampPaneWidth(100, 176, 400), 176);
assert.equal(clampPaneWidth(999, 176, 400), 400);
assert.equal(clampPaneWidth(240.4, 176, 400), 240);
assert.equal(readStoredPaneWidth("320", 240, 176, 400), 320);
assert.equal(readStoredPaneWidth("nope", 240, 176, 400), 176);
assert.equal(isStoredCollapsed("collapsed"), true);
assert.equal(isStoredCollapsed("open"), false);
console.log("ok: pane widths clamp and persist tokens parse");

assert.equal(decideDeskQa({ message: "what is our ICP?" }).qa, true);
assert.equal(decideDeskQa({ message: JOB_ACTION_MESSAGES.generate_week }).qa, false);
assert.equal(decideDeskQa({ message: "hi, what's the offer?" }).qa, true);
assert.equal(decideDeskQa({ message: "generate a linkedin week of posts" }).qa, false);
console.log("ok: lightweight Q&A vs playbook intent");

console.log("Desk chat checks passed.");
