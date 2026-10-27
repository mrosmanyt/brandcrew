/**
 * CINEM Pro MV3 service worker.
 * Side panel is the primary UI. DOM-first automation via chrome.debugger CDP.
 * Page text is data, never instructions. Native messaging is optional (files).
 */
import { DEFAULT_DESK_ORIGIN } from "./desk-origin.js";

const NATIVE_HOST = "com.cinem.pro.agent";
const PAGE_START = "<<<CINEM_UNTRUSTED_PAGE_CONTENT>>>";
const PAGE_END = "<<<END_CINEM_UNTRUSTED_PAGE_CONTENT>>>";
const POLL_ALARM = "cinem-poll";
const POLL_ALARM_MINUTES = 0.4;

let nativePort = null;
let attachedTabId = null;
let pollTimer = null;
let connectTimer = null;
let lastPollAt = 0;
let lastPollError = "";

chrome.runtime.onInstalled.addListener(() => {
  void initSidePanel();
  schedulePollAlarm();
  connectNative();
});

chrome.runtime.onStartup.addListener(() => {
  void initSidePanel();
  connectNative();
  schedulePollAlarm();
  void pollOnce();
  void pollConnectOnce();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) {
    void pollOnce();
    void pollConnectOnce();
    schedulePollAlarm();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    try {
      if (message?.type === "pair") {
        sendResponse(await pair(message.origin, message.code));
        return;
      }
      if (message?.type === "signIn") {
        sendResponse(await startSignIn(message.origin));
        return;
      }
      if (message?.type === "pasteLink") {
        sendResponse(await claimFromLink(message.origin, message.link));
        return;
      }
      if (message?.type === "cancelConnect") {
        await chrome.storage.local.remove(["connectingNonce", "connectingOrigin"]);
        stopConnectPoll();
        sendResponse({ ok: true });
        return;
      }
      if (message?.type === "status") {
        sendResponse(await getStatus());
        return;
      }
      if (message?.type === "poll") {
        await pollOnce();
        await pollConnectOnce();
        sendResponse(await getStatus());
        return;
      }
      if (message?.type === "unpair") {
        stopConnectPoll();
        await chrome.storage.local.clear();
        sendResponse({ ok: true });
        return;
      }
      if (message?.type === "openPanel") {
        sendResponse(await openSidePanel());
        return;
      }
      if (message?.type === "deskFetch") {
        sendResponse(await deskFetch(message.path, message.method, message.body));
        return;
      }
      sendResponse({ ok: false, error: "Unknown message." });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();
  return true;
});

async function initSidePanel() {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    await chrome.sidePanel.setOptions({ path: "sidepanel.html", enabled: true });
  } catch {
    // Chrome without sidePanel — popup remains.
  }
}

function schedulePollAlarm() {
  try {
    chrome.alarms.create(POLL_ALARM, { delayInMinutes: POLL_ALARM_MINUTES });
  } catch {
    chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 });
  }
}

async function openSidePanel() {
  try {
    const window = await chrome.windows.getCurrent();
    if (window?.id != null) {
      await chrome.sidePanel.open({ windowId: window.id });
      return { ok: true };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not open the side panel." };
  }
  return { ok: false, error: "Could not open the side panel." };
}

function connectNative() {
  if (nativePort) return;
  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST);
    nativePort.onMessage.addListener((msg) => {
      if (msg?.type === "command") void runCommand(msg.command);
    });
    nativePort.onDisconnect.addListener(() => {
      nativePort = null;
    });
    nativePort.postMessage({ type: "hello", source: "extension" });
  } catch {
    nativePort = null;
  }
}

async function getState() {
  return chrome.storage.local.get([
    "origin",
    "token",
    "workspaceId",
    "deviceId",
    "name",
    "connectingNonce",
    "connectingOrigin",
    "lastPollError",
    "lastPollAt",
  ]);
}

async function getStatus() {
  const state = await getState();
  return {
    ok: true,
    paired: Boolean(state.token),
    connecting: Boolean(state.connectingNonce) && !state.token,
    origin: state.origin || state.connectingOrigin || DEFAULT_DESK_ORIGIN,
    workspaceId: state.workspaceId || "",
    nativeHost: Boolean(nativePort),
    attachedTabId,
    pollError: lastPollError || state.lastPollError || "",
    lastPollAt: lastPollAt || state.lastPollAt || 0,
    version: chrome.runtime.getManifest().version,
  };
}

function randomNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function nonceFromLink(raw) {
  const trimmed = String(raw || "").trim();
  if (/^[a-fA-F0-9]{16,64}$/.test(trimmed)) return trimmed.toLowerCase();
  try {
    const url = new URL(trimmed);
    const nonce = url.searchParams.get("nonce") || "";
    if (/^[a-fA-F0-9]{16,64}$/.test(nonce)) return nonce.toLowerCase();
  } catch {
    const match = /[?&]nonce=([a-fA-F0-9]{16,64})/.exec(trimmed);
    if (match) return match[1].toLowerCase();
  }
  return "";
}

function stopConnectPoll() {
  if (connectTimer) {
    clearInterval(connectTimer);
    connectTimer = null;
  }
}

async function storeDevice(base, data) {
  await chrome.storage.local.set({
    origin: base,
    token: data.token,
    workspaceId: data.workspaceId,
    deviceId: data.deviceId || data.device?.id,
    name: data.name || data.device?.name,
    lastPollError: "",
  });
  await chrome.storage.local.remove(["connectingNonce", "connectingOrigin"]);
  stopConnectPoll();
  startFastPoll();
}

async function startSignIn(origin) {
  const base = String(origin || "").replace(/\/$/, "") || DEFAULT_DESK_ORIGIN;
  const nonce = randomNonce();
  const res = await fetch(`${base}/api/auth/connect`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nonce,
      surface: "extension",
      origin: base,
      name: "Chrome",
      deviceName: "Chrome",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not start Sign in with CINEM.");
  await chrome.storage.local.set({ connectingNonce: data.nonce || nonce, connectingOrigin: base });
  const url = data.approveUrl || `${base}/connect/extension?nonce=${data.nonce || nonce}`;
  await chrome.tabs.create({ url });
  startConnectPoll();
  return { ok: true, connecting: true };
}

async function claimFromLink(origin, link) {
  const nonce = nonceFromLink(link);
  if (!nonce) throw new Error("Paste the full login link from the desk (it includes nonce=).");
  let base = String(origin || "").replace(/\/$/, "");
  try {
    const url = new URL(link);
    if (url.origin.startsWith("http")) base = url.origin;
  } catch {
    // keep origin field
  }
  if (!base) base = DEFAULT_DESK_ORIGIN;
  await chrome.storage.local.set({ connectingNonce: nonce, connectingOrigin: base });
  const claimed = await claimNonce(base, nonce);
  if (claimed) return { ok: true };
  startConnectPoll();
  try {
    await chrome.tabs.create({ url: `${base}/connect/extension?nonce=${nonce}` });
  } catch {
    // side panel may still poll
  }
  return { ok: true, connecting: true };
}

async function claimNonce(base, nonce) {
  const res = await fetch(`${base}/api/auth/connect/claim`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nonce }),
  });
  const data = await res.json();
  if (data.status === "approved" && data.token) {
    await storeDevice(base, data);
    return true;
  }
  if (res.status === 410 || data.status === "expired" || data.status === "claimed") {
    await chrome.storage.local.remove(["connectingNonce", "connectingOrigin"]);
    throw new Error(data.error || "That sign-in link expired. Start again.");
  }
  return false;
}

function startConnectPoll() {
  if (connectTimer) clearInterval(connectTimer);
  connectTimer = setInterval(() => void pollConnectOnce(), 2000);
  void pollConnectOnce();
}

async function pollConnectOnce() {
  const state = await getState();
  if (!state.connectingNonce || state.token) {
    if (state.token) stopConnectPoll();
    return;
  }
  try {
    await claimNonce(state.connectingOrigin || state.origin || DEFAULT_DESK_ORIGIN, state.connectingNonce);
  } catch {
    // still pending
  }
}

async function pair(origin, code) {
  const base = String(origin || "").replace(/\/$/, "") || DEFAULT_DESK_ORIGIN;
  const res = await fetch(`${base}/api/device/claim`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code: String(code || "").trim().toUpperCase(),
      name: "Chrome",
      nativeHost: Boolean(nativePort),
      capabilities: ["debugger", nativePort ? "native" : ""].filter(Boolean),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Pairing failed.");
  await storeDevice(base, {
    token: data.token,
    workspaceId: data.workspaceId,
    device: data.device,
  });
  return { ok: true, workspaceId: data.workspaceId };
}

function startFastPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => void pollOnce(), 2500);
  schedulePollAlarm();
  void pollOnce();
}

async function rememberPoll(error) {
  lastPollAt = Date.now();
  lastPollError = error || "";
  await chrome.storage.local.set({ lastPollAt, lastPollError });
}

async function pollOnce() {
  const state = await getState();
  if (!state.token || !state.origin) return;
  connectNative();
  try {
    const heartbeat = await fetch(`${state.origin}/api/device/heartbeat`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${state.token}`,
        "x-cinem-native-host": nativePort ? "1" : "0",
      },
    });
    if (heartbeat.status === 401) {
      await chrome.storage.local.remove(["token", "workspaceId", "deviceId"]);
      await rememberPoll("Signed out. Sign in with CINEM again.");
      return;
    }
    const res = await fetch(`${state.origin}/api/device/commands`, {
      headers: { authorization: `Bearer ${state.token}` },
    });
    if (res.status === 401) {
      await chrome.storage.local.remove(["token", "workspaceId", "deviceId"]);
      await rememberPoll("Signed out. Sign in with CINEM again.");
      return;
    }
    if (!res.ok) {
      await rememberPoll(`Desk returned ${res.status}.`);
      return;
    }
    const data = await res.json();
    for (const command of data.commands || []) {
      await runCommand(command, state);
    }
    await rememberPoll("");
  } catch {
    await rememberPoll("Desk unreachable. Check the network, then retry.");
  }
}

async function deskFetch(path, method, body) {
  const state = await getState();
  if (!state.token || !state.origin) {
    return { ok: false, httpOk: false, error: "Extension not connected. Sign in with CINEM." };
  }
  const clean = String(path || "");
  if (!clean.startsWith("/api/device/")) {
    return { ok: false, httpOk: false, error: "Only desk device APIs are allowed from this panel." };
  }
  const res = await fetch(`${state.origin}${clean}`, {
    method: method || "GET",
    headers: {
      authorization: `Bearer ${state.token}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ...data, httpOk: res.ok, status: res.status, ok: res.ok && data.ok !== false };
}

async function runCommand(command, state) {
  const st = state || (await getState());
  let result;
  try {
    result = await executeTool(command.tool, command.args || {});
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      engine: "cdp",
    };
  }
  if (st.origin && st.token && command.id) {
    await fetch(`${st.origin}/api/device/commands/${command.id}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${st.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(result),
    });
  }
  if (nativePort && command.id) {
    nativePort.postMessage({ type: "result", commandId: command.id, result });
  }
}

function hostAllowed(url, allowlist) {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return { ok: false, host: "", reason: "Could not parse URL host." };
  }
  const allowed = (allowlist || [])
    .map((row) => String(row).replace(/^www\./, "").toLowerCase())
    .filter(Boolean);
  if (!allowed.length) {
    return { ok: false, host, reason: `No domain allowlist — refusing ${host}.` };
  }
  if (allowed.some((entry) => host === entry || host.endsWith(`.${entry}`))) {
    return { ok: true, host };
  }
  return {
    ok: false,
    host,
    reason: `Aborted: ${host} is outside this job’s allowlist (${allowed.join(", ")}).`,
    abortedDomain: host,
  };
}

function selectorInteractGuard(tool, args) {
  const blob = `${args.selector ?? ""} ${args.text ?? ""} ${args.value ?? ""} ${args.label ?? ""}`.toLowerCase();
  if (/(password|passwd|passcode|one-time|otp|credential)/.test(blob)) {
    return { ok: false, reason: "Refused: CINEM Pro never fills password or credential fields." };
  }
  if (/(log[\s-]?in|sign[\s-]?in|sign[\s-]?up|auth|sso)/.test(blob)) {
    return { ok: false, reason: "Refused: no auto-login. Use a public page, or pause with ask_user." };
  }
  if (/(send|publish|post now|submit message|mail\.send|tweet)/.test(blob)) {
    return { ok: false, reason: "Refused: no external send. Pause with ask_user instead." };
  }
  return { ok: true };
}

async function pageFieldGuard(selector) {
  const info = await evalInPage(
    `(() => {
      const sel = ${JSON.stringify(selector)};
      const el = document.querySelector(sel) || [...document.querySelectorAll("input,textarea,button,a,[contenteditable]")].find((n) => (n.innerText || n.getAttribute("aria-label") || "").includes(sel));
      if (!el) return { found: false };
      const type = (el.getAttribute("type") || "").toLowerCase();
      const name = (el.getAttribute("name") || "").toLowerCase();
      const autocomplete = (el.getAttribute("autocomplete") || "").toLowerCase();
      return { found: true, type, name, autocomplete, tag: el.tagName };
    })()`,
  );
  if (!info?.found) return { ok: true };
  const blob = `${info.type} ${info.name} ${info.autocomplete}`;
  if (info.type === "password" || /password|otp|passcode|one-time/.test(blob) || /current-password|new-password/.test(info.autocomplete || "")) {
    return { ok: false, reason: "Refused: CINEM Pro never fills password or credential fields." };
  }
  return { ok: true };
}

async function executeTool(tool, args) {
  if (tool === "native_file_read" || tool === "native_file_write" || tool === "native_long_job") {
    if (!nativePort) {
      return { ok: false, error: "Native host not connected. Run node native-host/install.mjs.", engine: "native" };
    }
    return await nativeCall(tool, args);
  }
  const allowlist = Array.isArray(args.allowedDomains) ? args.allowedDomains : [];
  if (tool === "browser_navigate") {
    const url = String(args.url || "");
    const check = hostAllowed(url, allowlist);
    if (!check.ok) {
      return { ok: false, error: check.reason, abortedDomain: check.abortedDomain || check.host, engine: "cdp" };
    }
    const tab = await ensureTab(url);
    await attach(tab.id);
    await send("Page.enable", {});
    await send("Page.navigate", { url });
    await waitLoad();
    const page = await snapshot(tab.id);
    const left = hostAllowed(page.url, allowlist);
    if (!left.ok) {
      return { ok: false, error: left.reason, abortedDomain: left.host, page, engine: "cdp" };
    }
    return { ok: page.ok, page, excerpt: page.excerpt, engine: "cdp" };
  }
  if (tool === "browser_tabs") {
    const urls = Array.isArray(args.urls) ? args.urls.map(String) : [];
    const pages = [];
    for (const url of urls.slice(0, 10)) {
      const check = hostAllowed(url, allowlist);
      if (!check.ok) {
        return { ok: false, error: check.reason, abortedDomain: check.abortedDomain || check.host, engine: "cdp", pages };
      }
      const tab = await chrome.tabs.create({ url, active: false });
      if (!tab.id) continue;
      await attach(tab.id);
      await send("Page.enable", {});
      await waitLoad();
      const page = await snapshot(tab.id);
      const left = hostAllowed(page.url, allowlist);
      if (!left.ok) {
        return { ok: false, error: left.reason, abortedDomain: left.host, page, pages, engine: "cdp" };
      }
      pages.push(page);
    }
    return { ok: pages.length > 0, pages, page: pages[0], excerpt: pages[0]?.excerpt, engine: "cdp" };
  }
  const tab = await activeAttachedTab();
  if (!tab) return { ok: false, error: "No attached Chrome tab. Navigate first.", engine: "cdp" };
  if (tab.url) {
    const check = hostAllowed(tab.url, allowlist);
    if (!check.ok) {
      return { ok: false, error: check.reason, abortedDomain: check.host, engine: "cdp" };
    }
  }
  if (tool === "browser_snapshot") {
    const page = await snapshot(tab.id);
    return { ok: page.ok, page, excerpt: page.excerpt, engine: "cdp" };
  }
  if (tool === "browser_extract") {
    const selector = String(args.selector || "body");
    const text = await evalInPage(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)}) || document.body; return (el.innerText || "").slice(0, 12000); })()`,
    );
    const page = await snapshot(tab.id);
    return { ok: true, page, extracted: String(text || ""), excerpt: String(text || "").slice(0, 280), engine: "cdp" };
  }
  if (tool === "browser_click" || tool === "browser_type") {
    const selector = String(args.selector || args.label || "");
    const guard = selectorInteractGuard(tool, args);
    if (!guard.ok) return { ok: false, error: guard.reason, engine: "cdp" };
    if (!selector) return { ok: false, error: `${tool} needs a selector.`, engine: "cdp" };
    const field = await pageFieldGuard(selector);
    if (!field.ok) return { ok: false, error: field.reason, engine: "cdp" };
    if (tool === "browser_click") {
      await evalInPage(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}) || [...document.querySelectorAll("a,button")].find(n => (n.innerText||"").includes(${JSON.stringify(selector)})); if (!el) throw new Error("No matching node"); el.click(); return true; })()`,
      );
      await waitLoad().catch(() => undefined);
    } else {
      const value = String(args.text ?? args.value ?? "");
      await evalInPage(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error("No matching node"); el.focus(); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`,
      );
    }
    const page = await snapshot(tab.id);
    const left = hostAllowed(page.url, allowlist);
    if (!left.ok) {
      return { ok: false, error: left.reason, abortedDomain: left.host, page, engine: "cdp" };
    }
    return { ok: true, page, excerpt: page.excerpt, engine: "cdp" };
  }
  if (tool === "browser_screenshot") {
    const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 40 });
    const page = await snapshot(tab.id);
    const b64 = shot?.data ? `data:image/jpeg;base64,${shot.data}` : undefined;
    return { ok: true, page, screenshot: b64, excerpt: page.excerpt, engine: "cdp" };
  }
  return { ok: false, error: `Unknown device tool ${tool}`, engine: "cdp" };
}

function nativeCall(tool, args) {
  return new Promise((resolve) => {
    if (!nativePort) {
      resolve({ ok: false, error: "Native host missing.", engine: "native" });
      return;
    }
    const id = `n-${Date.now()}`;
    const onMsg = (msg) => {
      if (msg?.replyTo !== id) return;
      nativePort.onMessage.removeListener(onMsg);
      resolve(msg.result || { ok: false, error: "Empty native result.", engine: "native" });
    };
    nativePort.onMessage.addListener(onMsg);
    nativePort.postMessage({ type: "call", id, tool, args });
    setTimeout(() => {
      nativePort?.onMessage.removeListener(onMsg);
      resolve({ ok: false, error: "Native host timed out.", engine: "native" });
    }, 10_000);
  });
}

async function ensureTab(url) {
  const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
  const existing = tabs.find((tab) => tab.id && tab.url && tab.url.startsWith(url.replace(/\/$/, "")));
  if (existing?.id) {
    await chrome.tabs.update(existing.id, { url, active: true });
    return existing;
  }
  return chrome.tabs.create({ url, active: true });
}

async function attach(tabId) {
  if (attachedTabId === tabId) return;
  if (attachedTabId != null) {
    try {
      await chrome.debugger.detach({ tabId: attachedTabId });
    } catch {
      // already detached
    }
  }
  await chrome.debugger.attach({ tabId }, "1.3");
  attachedTabId = tabId;
}

async function send(method, params) {
  if (attachedTabId == null) throw new Error("Debugger not attached.");
  return chrome.debugger.sendCommand({ tabId: attachedTabId }, method, params);
}

async function evalInPage(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result?.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Page evaluate failed.");
  }
  return result?.result?.value;
}

async function waitLoad() {
  await send("Page.enable", {});
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      chrome.debugger.onEvent.removeListener(onEvent);
      resolve();
    };
    const onEvent = (_source, method) => {
      if (method === "Page.loadEventFired" || method === "Page.domContentEventFired") finish();
    };
    chrome.debugger.onEvent.addListener(onEvent);
    setTimeout(finish, 8000);
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
}

async function snapshot(tabId) {
  const tab = await chrome.tabs.get(tabId);
  const url = tab.url || "";
  let title = tab.title || "";
  let text = "";
  try {
    text = String(
      (await evalInPage(
        `(() => { const t = document.title || ""; const body = (document.body && document.body.innerText) || ""; return JSON.stringify({ t, body: body.slice(0, 8000) }); })()`,
      )) || "",
    );
    const parsed = JSON.parse(text);
    title = parsed.t || title;
    text = parsed.body || "";
  } catch {
    text = "";
  }
  if (!text) {
    try {
      await send("Page.captureScreenshot", { format: "jpeg", quality: 20 });
    } catch {
      // ignore
    }
  }
  const links = [];
  try {
    const hrefs = await evalInPage(
      `JSON.stringify([...document.querySelectorAll("a[href]")].slice(0, 20).map(a => a.href))`,
    );
    const parsed = JSON.parse(hrefs || "[]");
    if (Array.isArray(parsed)) links.push(...parsed.map(String));
  } catch {
    // ignore
  }
  const excerpt = text.replace(/\s+/g, " ").trim().slice(0, 280);
  return {
    url,
    ok: Boolean(text || title),
    title,
    text: `${PAGE_START}\n${text}\n${PAGE_END}`,
    excerpt,
    links,
    engine: "cdp",
  };
}

async function activeAttachedTab() {
  if (attachedTabId != null) {
    try {
      const tab = await chrome.tabs.get(attachedTabId);
      return tab;
    } catch {
      attachedTabId = null;
    }
  }
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id) {
    await attach(tab.id);
    return tab;
  }
  return null;
}

void initSidePanel();
schedulePollAlarm();
startFastPoll();
