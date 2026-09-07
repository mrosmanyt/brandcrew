export const API_KEY_PREFIX = "bc_live_";
export const API_KEY_RATE_LIMIT = 60;
export const API_KEY_WINDOW_MS = 60_000;

export const V1_ENDPOINTS = [
  { method: "GET", path: "/api/v1", description: "Workspace id + endpoint list" },
  { method: "GET", path: "/api/v1/agents", description: "List agents" },
  {
    method: "POST",
    path: "/api/v1/agents",
    description: "Create an agent (name still defaults to New Agent)",
  },
  { method: "GET", path: "/api/v1/jobs", description: "List recent jobs" },
  { method: "POST", path: "/api/v1/jobs", description: "Start a job { agentId, message }" },
  { method: "GET", path: "/api/v1/jobs/:id", description: "Job status, events, artifacts" },
  { method: "GET", path: "/api/v1/artifacts", description: "List artifacts" },
  { method: "GET", path: "/api/v1/artifacts/:id", description: "One artifact" },
] as const;
