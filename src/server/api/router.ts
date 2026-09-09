import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { enforceSensitiveRateLimit } from "@/lib/rate-limit";
import { matchBestPattern, pathToSegments, type RouteParams } from "./match";
import * as adminRoot from "./admin/root";
import * as authGoogle from "./auth/google";
import * as authGoogleCallback from "./auth/google-callback";
import * as authLogin from "./auth/login";
import * as authLogout from "./auth/logout";
import * as authMe from "./auth/me";
import * as authSignup from "./auth/signup";
import * as billingCheckout from "./billing/checkout";
import * as whopWebhook from "./webhooks/whop";
import * as cronJobs from "./cron/jobs";
import * as inviteToken from "./invites/token";
import * as oauthCallback from "./oauth/callback";
import * as v1Agent from "./v1/agent";
import * as v1Agents from "./v1/agents";
import * as v1Artifact from "./v1/artifact";
import * as v1Artifacts from "./v1/artifacts";
import * as v1Job from "./v1/job";
import * as v1Jobs from "./v1/jobs";
import * as v1Root from "./v1/root";
import * as v1Workspace from "./v1/workspace";
import * as workspaceAgent from "./workspaces/agent";
import * as workspaceAgents from "./workspaces/agents";
import * as workspaceAgentsLaunch from "./workspaces/agents-launch";
import * as workspaceApiKey from "./workspaces/api-key";
import * as workspaceApiKeys from "./workspaces/api-keys";
import * as workspaceArtifact from "./workspaces/artifact";
import * as workspaceArtifacts from "./workspaces/artifacts";
import * as workspaceBrandKit from "./workspaces/brand-kit";
import * as workspaceCalendar from "./workspaces/calendar";
import * as workspaceChat from "./workspaces/chat";
import * as workspaceCompanions from "./workspaces/companions";
import * as workspacesCollection from "./workspaces/collection";
import * as workspaceInvite from "./workspaces/invite";
import * as workspaceInvites from "./workspaces/invites";
import * as workspaceJob from "./workspaces/job";
import * as workspaceJobReply from "./workspaces/job-reply";
import * as workspaceJobs from "./workspaces/jobs";
import * as workspaceSchedule from "./workspaces/schedule";
import * as workspaceSchedules from "./workspaces/schedules";
import * as workspaceUsage from "./workspaces/usage";
import * as workspaceMarketplace from "./workspaces/marketplace";
import * as workspaceMarketplaceBots from "./workspaces/marketplace-bots";
import * as workspacePluginConnect from "./workspaces/plugin-connect";
import * as workspacePluginOauthStart from "./workspaces/plugin-oauth-start";
import * as workspacePlugins from "./workspaces/plugins";
import * as workspaceSkillRun from "./workspaces/skill-run";
import * as workspaceSkills from "./workspaces/skills";
import * as workspaceTask from "./workspaces/task";
import * as workspaceTasks from "./workspaces/tasks";
import * as workspaceItem from "./workspaces/workspace";
import * as workspaceDevices from "./workspaces/devices";
import * as workspaceDevice from "./workspaces/device";
import * as workspaceApprovals from "./workspaces/approvals";
import * as workspaceAudit from "./workspaces/audit";
import * as workspacePhase2 from "./workspaces/phase2";
import * as deviceClaim from "./device/claim";
import * as deviceHeartbeat from "./device/heartbeat";
import * as deviceCommands from "./device/commands";
import * as deviceCommandResult from "./device/command-result";

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export type { RouteParams };
export type RouteContext = { params: Promise<RouteParams> };
export type RouteHandler = (
  request: Request,
  context: RouteContext,
) => Promise<Response> | Response;
export type HandlerModule = Partial<Record<HttpMethod, RouteHandler>>;

export type RouteSpec = {
  pattern: string[];
  handlers: HandlerModule;
};

function asHandlers(mod: object): HandlerModule {
  return mod as HandlerModule;
}

/**
 * One Route Handler file on Vercel = one serverless function. Keep every
 * public /api/* URL here so Hobby stays under the 12-function cap.
 * More literal segments win when two patterns could match (e.g. /agents/launch
 * vs /agents/:agentId).
 */
export const API_ROUTES: RouteSpec[] = [
  { pattern: ["api", "admin"], handlers: asHandlers(adminRoot) },
  { pattern: ["api", "v1"], handlers: asHandlers(v1Root) },
  { pattern: ["api", "v1", "workspace"], handlers: asHandlers(v1Workspace) },
  {
    pattern: ["api", "v1", "agents", ":agentId"],
    handlers: asHandlers(v1Agent),
  },
  { pattern: ["api", "v1", "agents"], handlers: asHandlers(v1Agents) },
  { pattern: ["api", "v1", "jobs", ":jobId"], handlers: asHandlers(v1Job) },
  { pattern: ["api", "v1", "jobs"], handlers: asHandlers(v1Jobs) },
  {
    pattern: ["api", "v1", "artifacts", ":artifactId"],
    handlers: asHandlers(v1Artifact),
  },
  { pattern: ["api", "v1", "artifacts"], handlers: asHandlers(v1Artifacts) },
  { pattern: ["api", "auth", "login"], handlers: asHandlers(authLogin) },
  { pattern: ["api", "auth", "signup"], handlers: asHandlers(authSignup) },
  { pattern: ["api", "auth", "me"], handlers: asHandlers(authMe) },
  { pattern: ["api", "auth", "logout"], handlers: asHandlers(authLogout) },
  {
    pattern: ["api", "auth", "google", "callback"],
    handlers: asHandlers(authGoogleCallback),
  },
  { pattern: ["api", "auth", "google"], handlers: asHandlers(authGoogle) },
  { pattern: ["api", "oauth", "callback"], handlers: asHandlers(oauthCallback) },
  { pattern: ["api", "billing", "checkout"], handlers: asHandlers(billingCheckout) },
  { pattern: ["api", "webhooks", "whop"], handlers: asHandlers(whopWebhook) },
  { pattern: ["api", "cron", "jobs"], handlers: asHandlers(cronJobs) },
  { pattern: ["api", "device", "claim"], handlers: asHandlers(deviceClaim) },
  { pattern: ["api", "device", "heartbeat"], handlers: asHandlers(deviceHeartbeat) },
  {
    pattern: ["api", "device", "commands", ":commandId"],
    handlers: asHandlers(deviceCommandResult),
  },
  { pattern: ["api", "device", "commands"], handlers: asHandlers(deviceCommands) },
  { pattern: ["api", "invites", ":token"], handlers: asHandlers(inviteToken) },
  { pattern: ["api", "workspaces"], handlers: asHandlers(workspacesCollection) },
  {
    pattern: ["api", "workspaces", ":workspaceId", "invites", ":inviteId"],
    handlers: asHandlers(workspaceInvite),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "invites"],
    handlers: asHandlers(workspaceInvites),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "usage"],
    handlers: asHandlers(workspaceUsage),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "devices", ":deviceId"],
    handlers: asHandlers(workspaceDevice),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "devices"],
    handlers: asHandlers(workspaceDevices),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "approvals"],
    handlers: asHandlers(workspaceApprovals),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "audit"],
    handlers: asHandlers(workspaceAudit),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "phase2"],
    handlers: asHandlers(workspacePhase2),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "schedules", ":scheduleId"],
    handlers: asHandlers(workspaceSchedule),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "schedules"],
    handlers: asHandlers(workspaceSchedules),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "api-keys", ":keyId"],
    handlers: asHandlers(workspaceApiKey),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "api-keys"],
    handlers: asHandlers(workspaceApiKeys),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "artifacts", ":artifactId"],
    handlers: asHandlers(workspaceArtifact),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "artifacts"],
    handlers: asHandlers(workspaceArtifacts),
  },
  {
    pattern: [
      "api",
      "workspaces",
      ":workspaceId",
      "plugins",
      ":pluginId",
      "oauth",
      "start",
    ],
    handlers: asHandlers(workspacePluginOauthStart),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "plugins", ":pluginId", "connect"],
    handlers: asHandlers(workspacePluginConnect),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "plugins"],
    handlers: asHandlers(workspacePlugins),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "calendar"],
    handlers: asHandlers(workspaceCalendar),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "skills", ":skillId", "run"],
    handlers: asHandlers(workspaceSkillRun),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "skills"],
    handlers: asHandlers(workspaceSkills),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "agents", "launch"],
    handlers: asHandlers(workspaceAgentsLaunch),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "agents", ":agentId"],
    handlers: asHandlers(workspaceAgent),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "agents"],
    handlers: asHandlers(workspaceAgents),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "tasks", ":taskId"],
    handlers: asHandlers(workspaceTask),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "tasks"],
    handlers: asHandlers(workspaceTasks),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "jobs", ":jobId", "reply"],
    handlers: asHandlers(workspaceJobReply),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "jobs", ":jobId"],
    handlers: asHandlers(workspaceJob),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "jobs"],
    handlers: asHandlers(workspaceJobs),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "companions"],
    handlers: asHandlers(workspaceCompanions),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "chat"],
    handlers: asHandlers(workspaceChat),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "brand-kit"],
    handlers: asHandlers(workspaceBrandKit),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "marketplace", "bots"],
    handlers: asHandlers(workspaceMarketplaceBots),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "marketplace"],
    handlers: asHandlers(workspaceMarketplace),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId"],
    handlers: asHandlers(workspaceItem),
  },
];

export { pathToSegments };

export type MatchedRoute = {
  score: number;
  params: RouteParams;
  handlers: HandlerModule;
  pattern: string[];
};

export function matchApiRoute(segments: string[]): MatchedRoute | null {
  const hit = matchBestPattern(
    API_ROUTES.map((route) => route.pattern),
    segments,
  );
  if (!hit) return null;
  const spec = API_ROUTES.find(
    (route) => route.pattern.join("/") === hit.pattern.join("/"),
  );
  if (!spec) return null;
  return { ...hit, handlers: spec.handlers };
}

export function allowedMethods(handlers: HandlerModule): HttpMethod[] {
  return HTTP_METHODS.filter((method) => typeof handlers[method] === "function");
}

export async function dispatchApi(
  request: Request,
  path: string[] | undefined,
): Promise<Response> {
  const segments = ["api", ...(path ?? [])];
  const matched = matchApiRoute(segments);
  if (!matched) {
    return NextResponse.json(
      { error: "Not found.", code: "not_found" },
      { status: 404 },
    );
  }
  const method = request.method.toUpperCase();
  try {
    await enforceSensitiveRateLimit(request, segments, method);
  } catch (error) {
    return jsonError(error);
  }
  const handler = matched.handlers[method as HttpMethod];
  if (!handler) {
    return NextResponse.json(
      { error: "Method not allowed.", code: "method_not_allowed" },
      {
        status: 405,
        headers: { Allow: allowedMethods(matched.handlers).join(", ") },
      },
    );
  }
  return handler(request, { params: Promise.resolve(matched.params) });
}
