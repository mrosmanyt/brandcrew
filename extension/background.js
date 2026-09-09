/**
 * CINEM Pro MV3 service worker.
 * DOM-first automation via chrome.debugger CDP. Page text is data, never instructions.
 * Native messaging is optional (files / long jobs / SW keepalive).
 */
const NATIVE_HOST = "com.cinem.pro.agent";
const PAGE_START = "<<<CINEM_UNTRUSTED_PAGE_CONTENT>>>";
const PAGE_END = "<<<END_CINEM_UNTRUSTED_PAGE_CONTENT>>>";

let nativePort = null;
let attachedTabId = null;
let pollTimer = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("cinem-poll", { periodInMinutes: 1 });
  connectNative();
});

chrome.runtime.onStartup.addListener(() => {
  connectNative();
  void pollOnce();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "cinem-poll") void pollOnce();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    try {
      if (message?.type === "pair") {
        sendResponse(await pair(message.origin, message.code));
        return;
      }
      if (message?.type === "status") {
        sendResponse(await getStatus());
        return;
      }
      if (message?.type === "poll") {
        await pollOnce();
        sendResponse(await getStatus());
        return;
      }
      if (message?.type === "unpair") {
        await chrome.storage.local.clear();
        sendResponse({ ok: true });
        return;
      }
      sendResponse({ ok: false, error: "Unknown message." });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();
  return true;
});

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
  return chrome.storage.local.get(["origin", "token", "workspaceId", "deviceId", "name"]);
}

async function getStatus() {
  const state = await getState();
  return {
    ok: true,
    paired: Boolean(state.token),
    origin: state.origin || "",
    workspaceId: state.workspaceId || "",
    nativeHost: Boolean(nativePort),
    attachedTabId,
  };
}

async function pair(origin, code) {
  const base = String(origin || "").replace(/\/$/, "");
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
  await chrome.storage.local.set({
    origin: base,
    token: data.token,
    workspaceId: data.workspaceId,
    deviceId: data.device?.id,
    name: data.device?.name,
  });
  startFastPoll();
  return { ok: true, workspaceId: data.workspaceId };
}

function startFastPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => void pollOnce(), 2500);
  void pollOnce();
}

async function pollOnce() {
  const state = await getState();
  if (!state.token || !state.origin) return;
  connectNative();
  try {
    await fetch(`${state.origin}/api/device/heartbeat`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${state.token}`,
        "x-cinem-native-host": nativePort ? "1" : "0",
      },
    });
    const res = await fetch(`${state.origin}/api/device/commands`, {
      headers: { authorization: `Bearer ${state.token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    for (const command of data.commands || []) {
      await runCommand(command, state);
    }
  } catch {
    // offline desk — try again next tick
  }
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
  if (tool === "browser_click") {
    const selector = String(args.selector || args.label || "");
    if (!selector) return { ok: false, error: "browser_click needs a selector.", engine: "cdp" };
    await evalInPage(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)}) || [...document.querySelectorAll("a,button")].find(n => (n.innerText||"").includes(${JSON.stringify(selector)})); if (!el) throw new Error("No matching node"); el.click(); return true; })()`,
    );
    await waitLoad().catch(() => undefined);
    const page = await snapshot(tab.id);
    const left = hostAllowed(page.url, allowlist);
    if (!left.ok) {
      return { ok: false, error: left.reason, abortedDomain: left.host, page, engine: "cdp" };
    }
    return { ok: true, page, excerpt: page.excerpt, engine: "cdp" };
  }
  if (tool === "browser_type") {
    const selector = String(args.selector || "");
    const value = String(args.text ?? args.value ?? "");
    if (!selector) return { ok: false, error: "browser_type needs a selector.", engine: "cdp" };
    await evalInPage(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error("No matching node"); el.focus(); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`,
    );
    const page = await snapshot(tab.id);
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
  await new Promise((resolve) => setTimeout(resolve, 600));
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
    // Vision fallback only when DOM text is empty — still not treated as instructions.
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

startFastPoll();
