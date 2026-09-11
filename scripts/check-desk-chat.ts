/**
 * Chat thread + live-progress + pane clamp guards. No database.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clampPaneWidth, isStoredCollapsed, readStoredPaneWidth } from "../src/lib/desk-layout";
import type { JobDTO, JobEventDTO } from "../src/lib/job-types";
import {
  buildChatThread,
  currentLiveHeadline,
  liveProgressFromEvents,
} from "../src/lib/live-progress";
import type { MessageDTO } from "../src/lib/types";
import { decideDeskQa, deskQaSystemPrompt } from "../src/lib/desk-qa-pure";
import { plannerSystemPrompt } from "../src/lib/agent-prompts";
import { JOB_ACTION_MESSAGES } from "../src/lib/constants";
import {
  AGENT_HELPFULNESS_SUFFIX,
  AGENT_IDENTITY_LOCK,
  IDENTITY_AND_BRANDING_RULE,
  LANGUAGE_AND_SCOPE_RULE,
  messagesWithLanguagePolicy,
  withAgentHelpfulness,
  withoutLegacyPitch,
  withoutProviderDisclosure,
} from "../src/lib/language-policy";
import {
  AVATAR_SHAPES,
  defaultAgentAvatarKind,
} from "../src/lib/agent-avatar";

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
assert.equal(decideDeskQa({ message: "MRE SATH URDU MEN BAAT KRO" }).qa, true);
assert.equal(decideDeskQa({ message: "WHAT IS THE CAPITAL CITY OF PAKISTAN" }).qa, true);
assert.equal(decideDeskQa({ message: "اردو میں بات کرو" }).qa, true);
console.log("ok: lightweight Q&A vs playbook intent");

assert.match(IDENTITY_AND_BRANDING_RULE, /CINEM Pro's AI/);
assert.match(IDENTITY_AND_BRANDING_RULE, /CINEM Pro made you/);
assert.match(
  IDENTITY_AND_BRANDING_RULE,
  /Never name Google, OpenAI, Anthropic, Gemini, GPT, Claude, xAI/,
);
assert.match(IDENTITY_AND_BRANDING_RULE, /large language model trained by/);
assert.match(
  IDENTITY_AND_BRANDING_RULE,
  /Main CINEM Pro ka AI model hoon — CINEM Pro ne mujhe banaya hai/,
);
assert.match(IDENTITY_AND_BRANDING_RULE, /CINEM Tech/);
assert.equal(LANGUAGE_AND_SCOPE_RULE.startsWith("Identity (non-negotiable):"), true);
assert.match(LANGUAGE_AND_SCOPE_RULE, /CINEM Pro's AI/);
assert.match(LANGUAGE_AND_SCOPE_RULE, /Never name Google, OpenAI, Anthropic, Gemini, GPT, Claude, xAI/);
assert.match(AGENT_IDENTITY_LOCK, /CINEM Pro's AI/);
assert.match(AGENT_IDENTITY_LOCK, /Never name Google, OpenAI, Anthropic, Gemini, GPT, Claude, xAI/);
assert.match(AGENT_HELPFULNESS_SUFFIX, /CINEM Pro's AI/);
assert.match(AGENT_HELPFULNESS_SUFFIX, /Never name Google, OpenAI, Anthropic, Gemini, GPT, Claude, xAI/);
console.log("ok: identity block is present and forbids provider names");

assert.match(LANGUAGE_AND_SCOPE_RULE, /Urdu/);
assert.match(LANGUAGE_AND_SCOPE_RULE, /Roman/);
assert.match(LANGUAGE_AND_SCOPE_RULE, /Never refuse to speak a language/);
assert.match(LANGUAGE_AND_SCOPE_RULE, /Never claim you operate in English only/);
assert.doesNotMatch(LANGUAGE_AND_SCOPE_RULE, /I operate in English only/);
assert.doesNotMatch(LANGUAGE_AND_SCOPE_RULE, /then offer to help with brand/);
assert.doesNotMatch(LANGUAGE_AND_SCOPE_RULE, /then offer brand or desk work/);
assert.match(LANGUAGE_AND_SCOPE_RULE, /Do not append unsolicited/);
assert.match(LANGUAGE_AND_SCOPE_RULE, /Only offer next steps when the user asks for work/);
const qaPrompt = deskQaSystemPrompt({
  agentName: "Prospect Peter",
  role: "Sales",
  kitBrief: "Hospitality brand kit",
});
assert.match(qaPrompt, /Urdu/);
assert.match(qaPrompt, /capital of a country/);
assert.match(qaPrompt, /Never claim you operate in English only/);
assert.match(qaPrompt, /CINEM Pro's AI/);
assert.match(qaPrompt, /Never name Google, OpenAI, Anthropic, Gemini, GPT, Claude, xAI/);
assert.equal(qaPrompt.startsWith("Identity (non-negotiable):"), true);
assert.doesNotMatch(qaPrompt, /I operate in English only/);
assert.doesNotMatch(qaPrompt, /then offer to help with brand/);
assert.doesNotMatch(qaPrompt, /then offer brand or desk work/);
assert.match(qaPrompt, /Do not pitch hospitality/);
assert.match(qaPrompt, /Only offer next steps when the user asks for work/);
const injected = messagesWithLanguagePolicy(
  [{ role: "system", content: "You are Prospect Peter." }],
  "general",
);
assert.equal((injected[0]?.content || "").startsWith("Identity (non-negotiable):"), true);
assert.match(injected[0]?.content || "", /CINEM Pro's AI/);
assert.match(injected[0]?.content || "", /Never name Google, OpenAI, Anthropic, Gemini, GPT, Claude, xAI/);
assert.match(injected[0]?.content || "", /Never refuse to speak a language/);
assert.match(injected[0]?.content || "", /Do not append unsolicited/);
assert.doesNotMatch(injected[0]?.content || "", /then offer brand or desk work/);
assert.doesNotMatch(injected[0]?.content || "", /Google made me/);
assert.equal(
  messagesWithLanguagePolicy([{ role: "system", content: "Pick a selector." }], "classify")[0]
    ?.content,
  "Pick a selector.",
);
const rewritten = messagesWithLanguagePolicy(
  [
    {
      role: "system",
      content:
        "You are Prospect Peter. Prefer this role's niche, but do not refuse basic helpful answers — answer briefly, then offer brand or desk work.",
    },
  ],
  "general",
);
assert.doesNotMatch(rewritten[0]?.content || "", /then offer brand or desk work/);
assert.match(rewritten[0]?.content || "", /Do not append unsolicited/);
console.log("ok: desk Q&A + global layer mirror Urdu, do not English-lock, and do not pitch after every answer");

assert.doesNotMatch(AGENT_HELPFULNESS_SUFFIX, /then offer brand/);
assert.match(AGENT_HELPFULNESS_SUFFIX, /Do not append unsolicited/);
assert.equal(
  withoutLegacyPitch("Answer briefly, then offer brand or desk work.").includes(
    "then offer brand",
  ),
  false,
);
const storedPeter = withAgentHelpfulness(
  "You are Prospect Peter. Never claim English-only. Prefer this role's niche, but do not refuse basic helpful answers — answer briefly, then offer brand or desk work.",
);
assert.doesNotMatch(storedPeter, /then offer brand or desk work/);
assert.match(storedPeter, /Do not append unsolicited/);
assert.match(storedPeter, /CINEM Pro's AI/);
assert.match(storedPeter, /Never name Google, OpenAI, Anthropic, Gemini, GPT, Claude, xAI/);
assert.equal(storedPeter.startsWith("You are CINEM Pro's AI"), true);
console.log("ok: stored helpfulness suffixes lose the pitch-after-every-answer closer");

assert.doesNotMatch(
  withoutProviderDisclosure("You are Prospect Peter. Google made me. I am Gemini."),
  /Google made me/,
);
assert.doesNotMatch(
  withoutProviderDisclosure("I am a large language model trained by OpenAI. CINEM Pro is not my owner."),
  /trained by OpenAI/,
);
assert.doesNotMatch(
  withoutProviderDisclosure("I am a large language model trained by OpenAI. CINEM Pro is not my owner."),
  /CINEM Pro is not my owner/,
);
const strippedBot = withAgentHelpfulness(
  "You are a sales bot powered by Google Gemini. Google made me.",
);
assert.doesNotMatch(strippedBot, /Google made me/);
assert.doesNotMatch(strippedBot, /powered by Google/);
assert.match(strippedBot, /CINEM Pro's AI/);
assert.match(strippedBot, /Never name Google, OpenAI, Anthropic, Gemini, GPT, Claude, xAI/);
const planPrompt = plannerSystemPrompt({
  agentName: "Prospect Peter",
  agentRoleLabel: "Sales",
  role: "sales",
});
assert.equal(planPrompt.startsWith("Identity (non-negotiable):"), true);
assert.match(planPrompt, /Never name Google, OpenAI, Anthropic, Gemini, GPT, Claude, xAI/);
console.log("ok: identity lock is early; provider-disclosure copy is stripped");

assert.equal(defaultAgentAvatarKind(), "cinem-mark");
assert.equal(defaultAgentAvatarKind(null), "cinem-mark");
assert.equal((AVATAR_SHAPES as readonly string[]).includes("cloud"), false);
const avatarUi = readFileSync("src/components/desk/agent-avatar.tsx", "utf8");
assert.match(avatarUi, /CinemMark/);
assert.match(avatarUi, /defaultAgentAvatarKind/);
assert.doesNotMatch(avatarUi, /case "cloud"/);
const chatUi = readFileSync("src/components/desk/chat-thread.tsx", "utf8");
assert.match(chatUi, /AgentAvatar/);
assert.doesNotMatch(chatUi, /Cloud/);
for (const file of [
  "src/components/desk/sidebar.tsx",
  "src/components/desk/companion-gallery.tsx",
  "src/components/desk/marketplace.tsx",
]) {
  const text = readFileSync(file, "utf8");
  assert.match(text, /AgentAvatar/);
}
console.log("ok: desk chat and default agent avatars use the CINEM mark, not a cloud");

console.log("Desk chat checks passed.");
