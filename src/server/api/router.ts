import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { enforceSensitiveRateLimit } from "@/lib/rate-limit";
import { isNativeCorsPath, nativeCorsPreflight, withNativeCors } from "@/lib/auth-native";
import { matchBestPattern, pathToSegments, type RouteParams } from "./match";
import * as adminRoot from "./admin/root";
import * as adminBackup from "./admin/backup";
import * as adminSupport from "./admin/support";
import * as adminSupportThread from "./admin/support-thread";
import * as adminPanel from "./admin/panel";
import * as supportRoot from "./support/root";
import * as supportPresence from "./support/presence";
import * as supportThread from "./support/thread";
import * as authGoogle from "./auth/google";
import * as authGoogleCallback from "./auth/google-callback";
import * as authGoogleIdToken from "./auth/google-id-token";
import * as authLogin from "./auth/login";
import * as authLogout from "./auth/logout";
import * as authMe from "./auth/me";
import * as authSignup from "./auth/signup";
import * as authToken from "./auth/token";
import * as authRefresh from "./auth/refresh";
import * as authRevoke from "./auth/revoke";
import * as billingCheckout from "./billing/checkout";
import * as billingSupport from "./billing/support";
import * as whopWebhook from "./webhooks/whop";
import * as geminigenImageWebhook from "./webhooks/geminigen-image";
import * as inviteToken from "./invites/token";
import * as v1Agent from "./v1/agent";
import * as v1Agents from "./v1/agents";
import * as v1Artifact from "./v1/artifact";
import * as v1Artifacts from "./v1/artifacts";
import * as v1Job from "./v1/job";
import * as v1Jobs from "./v1/jobs";
import * as v1Root from "./v1/root";
import * as v1Workspace from "./v1/workspace";
import * as workspaceApiKey from "./workspaces/api-key";
import * as workspaceApiKeys from "./workspaces/api-keys";
import * as workspacesCollection from "./workspaces/collection";
import * as workspaceInvite from "./workspaces/invite";
import * as workspaceInvites from "./workspaces/invites";
import * as workspaceMember from "./workspaces/member";
import * as workspaceUsage from "./workspaces/usage";
import * as workspaceItem from "./workspaces/workspace";
import * as guestChat from "./guest/chat";
import * as chatModels from "./chat/models";
import * as chatConversations from "./chat/conversations";
import * as chatConversation from "./chat/conversation";
import * as chatStream from "./chat/stream";
import * as chatVoiceTranscribe from "./chat/voice-transcribe";
import * as chatVoiceSpeak from "./chat/voice-speak";
import * as chatMemory from "./chat/memory";
import * as chatMemoryFact from "./chat/memory-fact";
import * as chatConnectors from "./chat/connectors";
import * as chatConnectorProbe from "./chat/connector-probe";
import * as chatMcpServers from "./chat/mcp-servers";
import * as chatMcpServer from "./chat/mcp-server";
import * as chatMcpServerTest from "./chat/mcp-server-test";
import * as chatHiggsfield from "./chat/higgsfield";
import * as composioCallback from "./composio/callback";
import * as crashReports from "./crash-reports";
import * as funnel from "./funnel";
import * as purchaseRequests from "./purchase-requests";
import * as builderProjects from "./builder/projects";
import * as builderProject from "./builder/project";
import * as builderGenerate from "./builder/generate";
import * as builderRestore from "./builder/restore";
import * as builderPublish from "./builder/publish";
import * as builderAssets from "./builder/assets";
import * as builderSettings from "./builder/settings";
import * as imageGenerate from "./image/generate";
import * as imageHistory from "./image/history";
import * as imageShare from "./image/share";
import * as shareRaw from "./share/raw";
import * as foundingSpots from "./founding/spots";
import * as userByok from "./user/byok";
import * as userInvite from "./user/invite";

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
 * More literal segments win when two patterns could match.
 */
export const API_ROUTES: RouteSpec[] = [
  { pattern: ["api", "admin"], handlers: asHandlers(adminRoot) },
  { pattern: ["api", "admin", "backup"], handlers: asHandlers(adminBackup) },
  { pattern: ["api", "admin", "panel"], handlers: asHandlers(adminPanel) },
  { pattern: ["api", "admin", "support"], handlers: asHandlers(adminSupport) },
  {
    pattern: ["api", "admin", "support", ":threadId"],
    handlers: asHandlers(adminSupportThread),
  },
  { pattern: ["api", "support"], handlers: asHandlers(supportRoot) },
  { pattern: ["api", "support", "presence"], handlers: asHandlers(supportPresence) },
  { pattern: ["api", "support", ":threadId"], handlers: asHandlers(supportThread) },
  { pattern: ["api", "guest", "chat"], handlers: asHandlers(guestChat) },
  { pattern: ["api", "chat", "models"], handlers: asHandlers(chatModels) },
  {
    pattern: ["api", "chat", "conversations"],
    handlers: asHandlers(chatConversations),
  },
  {
    pattern: ["api", "chat", "conversations", ":conversationId"],
    handlers: asHandlers(chatConversation),
  },
  { pattern: ["api", "chat", "stream"], handlers: asHandlers(chatStream) },
  {
    pattern: ["api", "chat", "voice", "transcribe"],
    handlers: asHandlers(chatVoiceTranscribe),
  },
  {
    pattern: ["api", "chat", "voice", "speak"],
    handlers: asHandlers(chatVoiceSpeak),
  },
  { pattern: ["api", "chat", "memory"], handlers: asHandlers(chatMemory) },
  {
    pattern: ["api", "chat", "memory", "facts", ":factId"],
    handlers: asHandlers(chatMemoryFact),
  },
  {
    pattern: ["api", "chat", "connectors"],
    handlers: asHandlers(chatConnectors),
  },
  {
    pattern: ["api", "chat", "connectors", "probe"],
    handlers: asHandlers(chatConnectorProbe),
  },
  {
    pattern: ["api", "chat", "mcp-servers"],
    handlers: asHandlers(chatMcpServers),
  },
  {
    pattern: ["api", "chat", "mcp-servers", ":serverId"],
    handlers: asHandlers(chatMcpServer),
  },
  {
    pattern: ["api", "chat", "mcp-servers", ":serverId", "test"],
    handlers: asHandlers(chatMcpServerTest),
  },
  {
    pattern: ["api", "chat", "higgsfield"],
    handlers: asHandlers(chatHiggsfield),
  },
  {
    pattern: ["api", "composio", "callback"],
    handlers: asHandlers(composioCallback),
  },
  { pattern: ["api", "crash-reports"], handlers: asHandlers(crashReports) },
  { pattern: ["api", "funnel"], handlers: asHandlers(funnel) },
  { pattern: ["api", "purchase-requests"], handlers: asHandlers(purchaseRequests) },
  { pattern: ["api", "builder", "projects"], handlers: asHandlers(builderProjects) },
  {
    pattern: ["api", "builder", "projects", ":projectId"],
    handlers: asHandlers(builderProject),
  },
  {
    pattern: ["api", "builder", "projects", ":projectId", "generate"],
    handlers: asHandlers(builderGenerate),
  },
  {
    pattern: ["api", "builder", "projects", ":projectId", "restore"],
    handlers: asHandlers(builderRestore),
  },
  {
    pattern: ["api", "builder", "projects", ":projectId", "publish"],
    handlers: asHandlers(builderPublish),
  },
  {
    pattern: ["api", "builder", "projects", ":projectId", "assets"],
    handlers: asHandlers(builderAssets),
  },
  {
    pattern: ["api", "builder", "assets", ":assetId"],
    handlers: asHandlers(builderAssets),
  },
  {
    pattern: ["api", "builder", "projects", ":projectId", "settings"],
    handlers: asHandlers(builderSettings),
  },
  { pattern: ["api", "image", "generate"], handlers: asHandlers(imageGenerate) },
  { pattern: ["api", "image", "history"], handlers: asHandlers(imageHistory) },
  { pattern: ["api", "image", "share"], handlers: asHandlers(imageShare) },
  {
    pattern: ["api", "share", "image", ":token", "raw"],
    handlers: asHandlers(shareRaw),
  },
  { pattern: ["api", "founding", "spots"], handlers: asHandlers(foundingSpots) },
  { pattern: ["api", "user", "byok"], handlers: asHandlers(userByok) },
  { pattern: ["api", "user", "invite"], handlers: asHandlers(userInvite) },
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
  { pattern: ["api", "auth", "token"], handlers: asHandlers(authToken) },
  { pattern: ["api", "auth", "refresh"], handlers: asHandlers(authRefresh) },
  { pattern: ["api", "auth", "revoke"], handlers: asHandlers(authRevoke) },
  {
    pattern: ["api", "auth", "google", "callback"],
    handlers: asHandlers(authGoogleCallback),
  },
  { pattern: ["api", "auth", "google"], handlers: asHandlers(authGoogle) },
  {
    pattern: ["api", "auth", "google", "id-token"],
    handlers: asHandlers(authGoogleIdToken),
  },
  { pattern: ["api", "billing", "checkout"], handlers: asHandlers(billingCheckout) },
  { pattern: ["api", "billing", "support"], handlers: asHandlers(billingSupport) },
  { pattern: ["api", "webhooks", "whop"], handlers: asHandlers(whopWebhook) },
  {
    pattern: ["api", "webhooks", "geminigen-image"],
    handlers: asHandlers(geminigenImageWebhook),
  },
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
    pattern: ["api", "workspaces", ":workspaceId", "members", ":memberId"],
    handlers: asHandlers(workspaceMember),
  },
  {
    pattern: ["api", "workspaces", ":workspaceId", "usage"],
    handlers: asHandlers(workspaceUsage),
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
  if (method === "OPTIONS") {
    if (isNativeCorsPath(segments)) return nativeCorsPreflight();
    return new NextResponse(null, {
      status: 204,
      headers: { Allow: allowedMethods(matched.handlers).join(", ") },
    });
  }
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
  let response: Response;
  try {
    response = await handler(request, { params: Promise.resolve(matched.params) });
  } catch (error) {
    return jsonError(error);
  }
  if (isNativeCorsPath(segments) && response instanceof NextResponse) {
    return withNativeCors(response);
  }
  return response;
}
