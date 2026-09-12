import { DEFAULT_DESK_ORIGIN } from "./desk-origin.js";

const errorEl = document.getElementById("error");
const statusLine = document.getElementById("status-line");
const detail = document.getElementById("detail");
const signin = document.getElementById("signin");
const unpair = document.getElementById("unpair");
const loginLinkInput = document.getElementById("login-link");

function showError(message) {
  errorEl.hidden = !message;
  errorEl.textContent = message || "";
}

function deskUrl(workspaceId) {
  return workspaceId ? `${DEFAULT_DESK_ORIGIN}/desk/${workspaceId}` : `${DEFAULT_DESK_ORIGIN}/desk`;
}

async function refresh() {
  const status = await chrome.runtime.sendMessage({ type: "status" });
  if (status?.paired) {
    statusLine.textContent = "Extension connected";
    detail.textContent = status.pollError
      ? `Reconnecting — ${status.pollError}`
      : "Paired to this Chrome. Open the side panel to chat and run live-tab jobs.";
    signin.hidden = true;
    unpair.hidden = false;
    return;
  }
  unpair.hidden = true;
  signin.hidden = false;
  if (status?.connecting) {
    statusLine.textContent = "Waiting for Sign in with CINEM…";
    detail.textContent = "Approve this Chrome in the tab that opened.";
    return;
  }
  statusLine.textContent = "Not connected";
  detail.textContent = "Open the side panel or Sign in with CINEM. Production desk only.";
}

document.getElementById("open-panel").addEventListener("click", async () => {
  showError("");
  const result = await chrome.runtime.sendMessage({ type: "openPanel" });
  if (!result?.ok) showError(result?.error || "Could not open the side panel.");
});

document.getElementById("open-desk").addEventListener("click", async () => {
  const status = await chrome.runtime.sendMessage({ type: "status" });
  await chrome.tabs.create({ url: deskUrl(status?.workspaceId) });
});

signin.addEventListener("click", async () => {
  showError("");
  const result = await chrome.runtime.sendMessage({ type: "signIn", origin: DEFAULT_DESK_ORIGIN });
  if (!result?.ok) showError(result?.error || "Could not start Sign in with CINEM.");
  await refresh();
});

document.getElementById("paste-link").addEventListener("click", async () => {
  showError("");
  const result = await chrome.runtime.sendMessage({
    type: "pasteLink",
    origin: DEFAULT_DESK_ORIGIN,
    link: loginLinkInput.value.trim(),
  });
  if (!result?.ok) showError(result?.error || "Could not use that login link.");
  await refresh();
});

unpair.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "unpair" });
  await refresh();
});

void refresh();
setInterval(() => void refresh(), 2000);
