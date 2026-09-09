const form = document.getElementById("pair-form");
const paired = document.getElementById("paired");
const originInput = document.getElementById("origin");
const codeInput = document.getElementById("code");
const errorEl = document.getElementById("error");
const statusLine = document.getElementById("status-line");

function showError(message) {
  errorEl.hidden = !message;
  errorEl.textContent = message || "";
}

async function refresh() {
  const status = await chrome.runtime.sendMessage({ type: "status" });
  if (status?.paired) {
    form.hidden = true;
    paired.hidden = false;
    statusLine.textContent = status.nativeHost
      ? `Paired with ${status.origin} · local agent connected`
      : `Paired with ${status.origin} · extension only (install native host for files)`;
  } else {
    form.hidden = false;
    paired.hidden = true;
  }
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

document.getElementById("poll").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "poll" });
  await refresh();
});

document.getElementById("unpair").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "unpair" });
  await refresh();
});

originInput.value = "http://127.0.0.1:43180";
void refresh();
