import { DEFAULT_DESK_ORIGIN } from "./desk-origin.js";

const waiting = document.getElementById("waiting");
const signin = document.getElementById("signin");
const chat = document.getElementById("chat");
const thread = document.getElementById("thread");
const errorEl = document.getElementById("error");
const statusPill = document.getElementById("status-pill");
const openDesk = document.getElementById("open-desk");
const agentSelect = document.getElementById("agent");
const promptEl = document.getElementById("prompt");
const approveBtn = document.getElementById("approve");
const loginLinkInput = document.getElementById("login-link");
const codeInput = document.getElementById("code");

let session = null;
let lastJobId = "";
let pollHandle = 0;

function showError(message) {
  errorEl.hidden = !message;
  errorEl.textContent = message || "";
}

function deskUrl(workspaceId) {
  const path = workspaceId ? `/desk/${workspaceId}` : "/desk";
  return `${DEFAULT_DESK_ORIGIN}${path}`;
}

function setStatus(text, tone) {
  statusPill.textContent = text;
  statusPill.className = tone || "";
}

function appendBubble(text, kind) {
  const el = document.createElement("div");
  el.className = `bubble ${kind || "agent"}`;
  el.textContent = text;
  thread.appendChild(el);
  thread.scrollTop = thread.scrollHeight;
}

function renderThread(items) {
  thread.replaceChildren();
  if (!items.length) {
    appendBubble("Ask CINEM Pro AI to research a public page, compare tabs, or draft — writes wait for you.", "progress");
    return;
  }
  for (const item of items) {
    appendBubble(item.text, item.kind);
  }
}

async function deskFetch(path, method, body) {
  return chrome.runtime.sendMessage({
    type: "deskFetch",
    path,
    method: method || "GET",
    body,
  });
}

async function refreshSession() {
  const status = await chrome.runtime.sendMessage({ type: "status" });
  if (status?.paired) {
    waiting.hidden = true;
    signin.hidden = true;
    chat.hidden = false;
    setStatus(status.pollError ? `Reconnecting… ${status.pollError}` : "Extension connected", status.pollError ? "wait" : "ok");
    openDesk.href = deskUrl(status.workspaceId);
    const data = await deskFetch("/api/device/session");
    if (!data?.httpOk) {
      setStatus(data?.error || "Desk unreachable", "bad");
      return status;
    }
    session = data;
    const agents = data.agents || [];
    const current = agentSelect.value;
    agentSelect.replaceChildren();
    for (const agent of agents) {
      const opt = document.createElement("option");
      opt.value = agent.id;
      opt.textContent = agent.name || "Agent";
      agentSelect.appendChild(opt);
    }
    if (agents.some((row) => row.id === current)) agentSelect.value = current;
    else if (data.agentId) agentSelect.value = data.agentId;
    if (data.workspace?.id) openDesk.href = deskUrl(data.workspace.id);
    await refreshJobs();
    return status;
  }
  chat.hidden = true;
  if (status?.connecting) {
    signin.hidden = true;
    waiting.hidden = false;
    setStatus("Waiting for Sign in with CINEM…", "wait");
    return status;
  }
  waiting.hidden = true;
  signin.hidden = false;
  setStatus("Not connected", "bad");
  openDesk.href = `${DEFAULT_DESK_ORIGIN}/desk`;
  return status;
}

function jobItems(payload) {
  const items = [];
  for (const message of payload.messages || []) {
    items.push({
      kind: message.role === "user" ? "user" : "agent",
      text: message.content || "",
    });
  }
  const job = payload.job || payload.jobs?.[0];
  if (job?.askPrompt && job.status === "needs_you") {
    items.push({ kind: "wait", text: job.askPrompt });
  }
  for (const line of payload.progress || []) {
    items.push({
      kind: line.tone === "error" ? "error" : line.tone === "wait" ? "wait" : "progress",
      text: line.label,
    });
  }
  return items;
}

async function refreshJobs() {
  if (!agentSelect.value) {
    renderThread([]);
    approveBtn.hidden = true;
    return;
  }
  const data = await deskFetch(`/api/device/jobs?agentId=${encodeURIComponent(agentSelect.value)}`);
  if (!data?.httpOk) return;
  const items = jobItems(data);
  renderThread(items);
  const job = data.job || data.jobs?.[0];
  lastJobId = job?.id || "";
  const needsApprove = job?.status === "needs_you" && job?.askKind !== "clarify";
  approveBtn.hidden = !needsApprove;
}

document.getElementById("signin-btn").addEventListener("click", async () => {
  showError("");
  const result = await chrome.runtime.sendMessage({ type: "signIn", origin: DEFAULT_DESK_ORIGIN });
  if (!result?.ok) showError(result?.error || "Could not start Sign in with CINEM.");
  await refreshSession();
});

document.getElementById("paste-link").addEventListener("click", async () => {
  showError("");
  const result = await chrome.runtime.sendMessage({
    type: "pasteLink",
    origin: DEFAULT_DESK_ORIGIN,
    link: loginLinkInput.value.trim(),
  });
  if (!result?.ok) showError(result?.error || "Could not use that login link.");
  await refreshSession();
});

document.getElementById("pair-code").addEventListener("click", async () => {
  showError("");
  const result = await chrome.runtime.sendMessage({
    type: "pair",
    origin: DEFAULT_DESK_ORIGIN,
    code: codeInput.value.trim(),
  });
  if (!result?.ok) showError(result?.error || "Pairing failed.");
  await refreshSession();
});

document.getElementById("cancel-wait").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "cancelConnect" });
  await refreshSession();
});

document.getElementById("attach").addEventListener("click", () => {
  const url = window.prompt("Paste a public https URL to research");
  if (!url) return;
  promptEl.value = `${promptEl.value ? `${promptEl.value.trim()}\n` : ""}${url}`.trim();
  promptEl.focus();
});

approveBtn.addEventListener("click", async () => {
  if (!lastJobId) return;
  showError("");
  const data = await deskFetch(`/api/device/jobs/${lastJobId}/reply`, "POST", { answer: "Yes" });
  if (!data?.httpOk) {
    showError(data?.error || "Could not approve.");
    return;
  }
  await refreshJobs();
});

document.getElementById("composer").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = promptEl.value.trim();
  if (!message) return;
  if (!agentSelect.value) {
    showError("Create an agent on the desk first, then return here.");
    return;
  }
  showError("");
  appendBubble(message, "user");
  promptEl.value = "";
  const data = await deskFetch("/api/device/jobs", "POST", {
    agentId: agentSelect.value,
    message,
  });
  if (!data?.httpOk) {
    appendBubble(data?.error || "Could not start that job.", "error");
    return;
  }
  if (data.qa) {
    const last = [...(data.messages || [])].reverse().find((row) => row.role === "assistant");
    if (last?.content) appendBubble(last.content, "agent");
  }
  await refreshJobs();
});

promptEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    document.getElementById("composer").requestSubmit();
  }
});

agentSelect.addEventListener("change", () => void refreshJobs());

void refreshSession();
pollHandle = window.setInterval(() => void refreshSession(), 4000);
window.addEventListener("unload", () => window.clearInterval(pollHandle));
