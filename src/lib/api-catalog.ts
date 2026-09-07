export const API_KEY_PREFIX = "cinem_live_";
export const API_KEY_PREFIX_LENGTH = 19;
export const API_KEY_RATE_LIMIT = 60;
export const API_KEY_WINDOW_MS = 60_000;

export type V1Endpoint = {
  method: "GET" | "POST";
  path: string;
  description: string;
  body?: Record<string, unknown>;
};

export const V1_ENDPOINTS: V1Endpoint[] = [
  {
    method: "GET",
    path: "/api/v1",
    description: "Workspace + endpoint catalog for this key",
  },
  {
    method: "GET",
    path: "/api/v1/workspace",
    description: "Workspace the key belongs to",
  },
  { method: "GET", path: "/api/v1/agents", description: "List agents" },
  {
    method: "POST",
    path: "/api/v1/agents",
    description: "Create an agent (name still defaults to New Agent)",
    body: { role: "Research", instructions: "Browse public pages. Do not send." },
  },
  {
    method: "GET",
    path: "/api/v1/agents/:agentId",
    description: "Get one agent",
  },
  { method: "GET", path: "/api/v1/jobs", description: "List recent jobs" },
  {
    method: "POST",
    path: "/api/v1/jobs",
    description: "Queue a job { agentId, message }",
    body: {
      agentId: "AGENT_ID",
      message: "Competitor scan of the Brand Kit site. Do not publish.",
    },
  },
  {
    method: "GET",
    path: "/api/v1/jobs/:jobId",
    description: "Job status, events, and artifacts",
  },
  { method: "GET", path: "/api/v1/artifacts", description: "List artifacts" },
  {
    method: "GET",
    path: "/api/v1/artifacts/:artifactId",
    description: "One artifact",
  },
];
