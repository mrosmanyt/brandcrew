import { DEFAULT_DESK_ORIGIN } from "./desk-origin.js";

const form = document.getElementById("pair-form");
const paired = document.getElementById("paired");
const waiting = document.getElementById("waiting");
const originInput = document.getElementById("origin");
const codeInput = document.getElementById("code");
const loginLinkInput = document.getElementById("login-link");
const errorEl = document.getElementById("error");
const statusLine = document.getElementById("status-line");
const waitingLine = document.getElementById("waiting-line");

function showError(message) {
  errorEl.hidden = !message;
  errorEl.textContent = message || "";
}

async function refresh() {
  const status = await chrome.runtime.sendMessage({ type: "status" });
  if (status?.paired) {
    form.hidden = true;
    waiting.hidden = true;
    paired.hidden = false;
    statusLine.textContent = status.nativeHost
      ? `Signed in · ${status.origin} · local agent connected`
      : `Signed in · ${status.origin} · extension only (install native host for files)`;
    return;
  }
  paired.hidden = true;
  if (status?.connecting) {
    form.hidden = true;
    waiting.hidden = false;
    waitingLine.textContent = "Waiting for Sign in with CINEM…";
    return;
  }
  waiting.hidden = true;
  form.hidden = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("");
  const result = await chrome.runtime.sendMessage({
    type: "pair",
    origin: originInput.value.trim(),
    code: codeInput.value.trim(),
  });
  if (!result?.ok) {
    showError(result?.error || "Pairing failed.");
    return;
  }
  await refresh();
});

document.getElementById("signin").addEventListener("click", async () => {
  showError("");
  const result = await chrome.runtime.sendMessage({
    type: "signIn",
    origin: originInput.value.trim(),
  });
  if (!result?.ok) {
    showError(result?.error || "Could not start Sign in with CINEM.");
    return;
  }
  await refresh();
});

document.getElementById("paste-link").addEventListener("click", async () => {
  showError("");
  const result = await chrome.runtime.sendMessage({
    type: "pasteLink",
    origin: originInput.value.trim(),
    link: loginLinkInput.value.trim(),
  });
  if (!result?.ok) {
    showError(result?.error || "Could not use that login link.");
    return;
  }
  await refresh();
});

document.getElementById("poll").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "poll" });
  await refresh();
});

document.getElementById("unpair").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "unpair" });
  await refresh();
});

document.getElementById("cancel-wait").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "cancelConnect" });
  await refresh();
});

originInput.value = DEFAULT_DESK_ORIGIN;
void refresh();
setInterval(() => void refresh(), 2000);
