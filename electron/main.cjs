/**
 * CINEM Pro desktop shell.
 * Packaged default: cloud desk at https://app.cinem.tech (same as the website)
 * plus Cinem AI Assistant from the bundled Vite renderer.
 * Local Next + Postgres only when CINEM_DESK_MODE=local (or unpackaged desktop:dev).
 */
const { app, BrowserWindow, BrowserView, Menu, shell, dialog, session, ipcMain } = require("electron");
const { spawn, fork } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const crypto = require("node:crypto");
const {
  SESSION_COOKIE,
  PROTOCOL,
  useCloudDesk: useCloudDeskFor,
  localOrigin: localOriginFor,
  resolveDeskOrigin,
  isAllowedNavigation,
  isPaymentExternal,
  chromeUserAgent,
  isIgnorableLoadError,
  deskPath,
  fetchWithTimeout,
} = require("./desk-shell.cjs");
const {
  CHROME_HEIGHT,
  ASSISTANT_PING,
  normalizeMode,
  parseStartMode,
  modeFromProtocolUrl,
  assistantDevOrigin,
  assistantIndexPath,
  isHttpUrl,
  verifyShellNonce,
} = require("./modes.cjs");
const { startAutoUpdates, openUpdatesWindow } = require("./updater.cjs");

const HOST = "127.0.0.1";

function packaged() {
  return app.isPackaged;
}

function envMode() {
  return {
    packaged: packaged(),
    env: process.env,
  };
}

function useCloudDesk() {
  return useCloudDeskFor(envMode());
}

function localLoopbackOrigin() {
  return localOriginFor(process.env);
}

function deskOrigin() {
  return resolveDeskOrigin(envMode());
}

const PORT = Number(process.env.BRANDCREW_PORT || 43180);
const ORIGIN = `http://${HOST}:${PORT}`;

if (process.env.ELECTRON_DISABLE_SANDBOX === "1") {
  app.commandLine.appendSwitch("no-sandbox");
}
if (process.platform === "linux") {
  app.disableHardwareAcceleration();
}

let serverChild = null;
let nativeChild = null;
let spawnedServer = false;
/** @type {Map<number, { win: import('electron').BrowserWindow, view: import('electron').BrowserView, mode: string, showingOffline: boolean }>} */
const shells = new Map();

function projectRoot() {
  return path.join(__dirname, "..");
}

function offlinePagePath() {
  return path.join(__dirname, "offline.html");
}

function chromePagePath() {
  return path.join(__dirname, "chrome.html");
}

function assistantMissingPath() {
  return path.join(__dirname, "assistant-missing.html");
}

function iconPath() {
  return packaged()
    ? path.join(process.resourcesPath, "brandcrew", "icon.png")
    : path.join(projectRoot(), "electron", "resources", "icon.png");
}

const LOCAL_POSTGRES =
  "postgresql://brandcrew:brandcrew@127.0.0.1:5432/brandcrew?schema=public";

function isFileDatabaseUrl(url) {
  const value = (url || "").trim();
  return !value || value.startsWith("file:") || value.startsWith("sqlite:");
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function writeEnvFile(filePath, values) {
  const lines = [
    "# CINEM Pro desktop environment (local mode only)",
    "# DATABASE_URL must be Postgres (local Docker or Neon). SQLite file: URLs no longer work.",
    "# Add API keys and OAuth client ids here, then restart the app.",
    "# OAuth redirect URI must be:",
    `#   ${ORIGIN}/api/oauth/callback`,
    "",
  ];
  for (const [key, value] of Object.entries(values)) {
    lines.push(`${key}=${value}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
}

function applyUserEnv() {
  const userData = app.getPath("userData");
  fs.mkdirSync(userData, { recursive: true });
  const envPath = path.join(userData, ".env");

  if (!fs.existsSync(envPath)) {
    writeEnvFile(envPath, {
      DATABASE_URL: LOCAL_POSTGRES,
      DIRECT_URL: LOCAL_POSTGRES,
      SESSION_SECRET: crypto.randomBytes(32).toString("hex"),
      OAUTH_REDIRECT_BASE: ORIGIN,
      APP_URL: ORIGIN,
      NEXT_PUBLIC_APP_URL: ORIGIN,
      BILLING_MOCK: "true",
      PLAYWRIGHT_ENABLED: "true",
    });
  }

  let parsed = parseEnvFile(envPath);
  if (isFileDatabaseUrl(parsed.DATABASE_URL)) {
    parsed.DATABASE_URL = LOCAL_POSTGRES;
    if (isFileDatabaseUrl(parsed.DIRECT_URL)) parsed.DIRECT_URL = LOCAL_POSTGRES;
    if (!parsed.DIRECT_URL) parsed.DIRECT_URL = LOCAL_POSTGRES;
    writeEnvFile(envPath, parsed);
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }

  if (isFileDatabaseUrl(process.env.DATABASE_URL)) {
    process.env.DATABASE_URL = LOCAL_POSTGRES;
  }
  if (isFileDatabaseUrl(process.env.DIRECT_URL)) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
  if (!process.env.OAUTH_REDIRECT_BASE) process.env.OAUTH_REDIRECT_BASE = ORIGIN;
  if (!process.env.APP_URL) process.env.APP_URL = ORIGIN;
  if (!process.env.NEXT_PUBLIC_APP_URL) process.env.NEXT_PUBLIC_APP_URL = ORIGIN;
  process.env.PORT = String(PORT);
  process.env.HOSTNAME = HOST;
  return { userData, envPath };
}

function ping() {
  return new Promise((resolve) => {
    const req = http.get(`${ORIGIN}/`, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await ping()) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`CINEM Pro did not become ready at ${ORIGIN}`);
}

function npmCmd() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function startNativeAgent() {
  const host = path.join(projectRoot(), "native-host", "host.mjs");
  if (!fs.existsSync(host) || nativeChild) return;
  const bin = packaged() ? process.execPath : "node";
  const env = { ...process.env, CINEM_NATIVE_PORT: "43181" };
  if (packaged()) env.ELECTRON_RUN_AS_NODE = "1";
  nativeChild = spawn(bin, [host, "--http"], {
    cwd: projectRoot(),
    env,
    stdio: "inherit",
  });
  nativeChild.on("exit", () => {
    nativeChild = null;
  });
}

function startDevServer() {
  serverChild = spawn(npmCmd(), ["run", "dev"], {
    cwd: projectRoot(),
    env: { ...process.env, PORT: String(PORT) },
    stdio: "inherit",
  });
  serverChild.on("exit", (code) => {
    if (code && code !== 0) {
      console.error("next dev exited", code);
    }
  });
}

function startPackagedServer() {
  const standalone = path.join(process.resourcesPath, "standalone");
  const serverJs = path.join(standalone, "server.js");
  if (!fs.existsSync(serverJs)) {
    throw new Error(
      "Packaged Next server is missing. Rebuild with npm run desktop:build.",
    );
  }
  serverChild = fork(serverJs, [], {
    cwd: standalone,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(PORT),
      HOSTNAME: HOST,
      NODE_ENV: "production",
    },
    execPath: process.execPath,
    stdio: "inherit",
  });
}

function navigationOpts() {
  return {
    deskOrigin: deskOrigin(),
    localOrigin: localLoopbackOrigin(),
    assistantOrigin: assistantDevOrigin(process.env),
  };
}

function handleExternalOrAllow(url) {
  if (isAllowedNavigation(url, navigationOpts()) && !isPaymentExternal(url)) {
    return { action: "allow" };
  }
  void shell.openExternal(url);
  return { action: "deny" };
}

function attachNavigationGuards(contents) {
  contents.setWindowOpenHandler(({ url }) => handleExternalOrAllow(url));
  contents.on("will-navigate", (event, url) => {
    if (isAllowedNavigation(url, navigationOpts()) && !isPaymentExternal(url)) return;
    event.preventDefault();
    void shell.openExternal(url);
  });
  contents.on("will-redirect", (event, url) => {
    if (isAllowedNavigation(url, navigationOpts()) && !isPaymentExternal(url)) return;
    event.preventDefault();
    void shell.openExternal(url);
  });
}

function layoutView(win, view) {
  if (!win || win.isDestroyed() || !view) return;
  const [width, height] = win.getContentSize();
  view.setBounds({
    x: 0,
    y: CHROME_HEIGHT,
    width,
    height: Math.max(120, height - CHROME_HEIGHT),
  });
}

function shellFromContents(contents) {
  for (const entry of shells.values()) {
    if (entry.win.webContents === contents || entry.view.webContents === contents) {
      return entry;
    }
  }
  return null;
}

function findShellByMode(mode) {
  for (const entry of shells.values()) {
    if (entry.mode === mode && !entry.win.isDestroyed()) return entry;
  }
  return null;
}

function firstShell() {
  for (const entry of shells.values()) {
    if (!entry.win.isDestroyed()) return entry;
  }
  return null;
}

function showOfflinePage(entry) {
  if (!entry || !entry.view || entry.showingOffline) return;
  const file = offlinePagePath();
  if (!fs.existsSync(file)) return;
  entry.showingOffline = true;
  void entry.view.webContents.loadFile(file);
}

function loadDesk(pathName = "/desk", entry = firstShell()) {
  if (!entry || !entry.view || entry.view.webContents.isDestroyed()) return Promise.resolve();
  entry.showingOffline = false;
  const url = `${deskOrigin()}${deskPath(pathName)}`;
  return entry.view.webContents.loadURL(url).catch((error) => {
    const code = error && (error.errno ?? error.code);
    if (isIgnorableLoadError(code) || code === "ERR_ABORTED") return;
    console.error("CINEM desktop desk load failed", error);
    showOfflinePage(entry);
  });
}

function loadAssistant(entry) {
  if (!entry || !entry.view || entry.view.webContents.isDestroyed()) return Promise.resolve();
  entry.showingOffline = false;
  const index = assistantIndexPath({
    packaged: packaged(),
    resourcesPath: process.resourcesPath,
    projectRoot: projectRoot(),
  });
  if (fs.existsSync(index)) {
    return entry.view.webContents.loadFile(index).catch((error) => {
      console.error("CINEM assistant load failed", error);
    });
  }
  if (!packaged()) {
    return entry.view.webContents.loadURL(assistantDevOrigin(process.env)).catch(() => {
      if (fs.existsSync(assistantMissingPath())) {
        return entry.view.webContents.loadFile(assistantMissingPath());
      }
    });
  }
  if (fs.existsSync(assistantMissingPath())) {
    return entry.view.webContents.loadFile(assistantMissingPath());
  }
  return Promise.resolve();
}

function attachViewEvents(entry) {
  entry.view.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (entry.mode !== "desk") return;
      if (!isMainFrame || isIgnorableLoadError(errorCode)) return;
      if (validatedURL && String(validatedURL).startsWith("file:")) return;
      console.error("CINEM desktop did-fail-load", errorCode, errorDescription);
      showOfflinePage(entry);
    },
  );
  entry.view.webContents.on("render-process-gone", (_event, details) => {
    if (details.reason === "clean-exit") return;
    console.error("CINEM desktop renderer gone", details.reason);
    if (entry.mode === "desk") showOfflinePage(entry);
  });
}

function createContentView(mode) {
  const ua = chromeUserAgent(app.userAgentFallback || session.defaultSession.getUserAgent());
  return new BrowserView({
    webPreferences: {
      preload:
        mode === "assistant"
          ? path.join(__dirname, "assistant-preload.cjs")
          : path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      userAgent: ua,
    },
  });
}

async function applyMode(entry, mode, deskPathName = "/desk") {
  const next = normalizeMode(mode);
  if (next === "both") return;
  const needsNewView = !entry.view || entry.mode !== next;
  if (needsNewView) {
    if (entry.view) {
      try {
        entry.win.removeBrowserView(entry.view);
      } catch {
        /* already detached */
      }
    }
    entry.view = createContentView(next);
    entry.win.setBrowserView(entry.view);
    attachViewEvents(entry);
    layoutView(entry.win, entry.view);
  } else {
    entry.win.setBrowserView(entry.view);
    layoutView(entry.win, entry.view);
  }
  entry.mode = next;
  entry.win.setTitle(next === "assistant" ? "Cinem AI Assistant" : "CINEM Pro");
  if (!entry.win.webContents.isDestroyed()) {
    entry.win.webContents.send("cinem:mode", next);
  }
  if (next === "assistant") {
    await loadAssistant(entry);
  } else {
    await loadDesk(deskPathName, entry);
  }
}

function createShellWindow(mode = "desk") {
  const startMode = normalizeMode(mode) === "both" ? "desk" : normalizeMode(mode);
  const existing = findShellByMode(startMode);
  if (existing) {
    if (existing.win.isMinimized()) existing.win.restore();
    existing.win.focus();
    return existing;
  }

  const ua = chromeUserAgent(app.userAgentFallback || session.defaultSession.getUserAgent());
  const icon = iconPath();

  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    title: startMode === "assistant" ? "Cinem AI Assistant" : "CINEM Pro",
    backgroundColor: "#09090b",
    autoHideMenuBar: true,
    show: false,
    icon: fs.existsSync(icon) ? icon : undefined,
    webPreferences: {
      preload: path.join(__dirname, "chrome-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      userAgent: ua,
    },
  });

  const entry = {
    win,
    view: null,
    mode: startMode,
    showingOffline: false,
  };
  shells.set(win.id, entry);

  win.on("resize", () => layoutView(win, entry.view));
  win.on("closed", () => {
    shells.delete(win.id);
  });
  win.once("ready-to-show", () => {
    if (!win.isDestroyed()) win.show();
  });

  void win.loadFile(chromePagePath(), { query: { mode: startMode } }).then(() => {
    void applyMode(entry, startMode);
  });

  return entry;
}

async function showMode(mode, deskPathName = "/desk") {
  const next = normalizeMode(mode);
  if (next === "both") {
    await openBoth();
    return;
  }
  const existing = findShellByMode(next);
  if (existing) {
    if (existing.win.isMinimized()) existing.win.restore();
    existing.win.focus();
    if (next === "desk" && deskPathName && deskPathName !== "/desk") {
      await loadDesk(deskPathName, existing);
    }
    return;
  }
  const focused = BrowserWindow.getFocusedWindow();
  const focusedShell = focused ? shells.get(focused.id) : null;
  if (focusedShell && shells.size === 1) {
    await applyMode(focusedShell, next, deskPathName);
    return;
  }
  const created = createShellWindow(next);
  if (next === "desk" && deskPathName && deskPathName !== "/desk") {
    await loadDesk(deskPathName, created);
  }
}

async function openBoth() {
  if (!findShellByMode("desk")) createShellWindow("desk");
  if (!findShellByMode("assistant")) createShellWindow("assistant");
  const assistant = findShellByMode("assistant");
  const desk = findShellByMode("desk");
  if (desk && desk.win.isMinimized()) desk.win.restore();
  if (assistant && assistant.win.isMinimized()) assistant.win.restore();
  if (assistant) assistant.win.focus();
}

function refreshTokenPath() {
  return path.join(app.getPath("userData"), "refresh-token");
}

function readStoredRefresh() {
  try {
    const file = refreshTokenPath();
    if (!fs.existsSync(file)) return "";
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    return "";
  }
}

function writeStoredRefresh(token) {
  const file = refreshTokenPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, token, { mode: 0o600 });
}

async function setSessionCookieOnOrigin(origin, accessToken) {
  const parsed = new URL(origin);
  await session.defaultSession.cookies.set({
    url: origin,
    name: SESSION_COOKIE,
    value: accessToken,
    path: "/",
    httpOnly: true,
    secure: parsed.protocol === "https:",
    sameSite: "lax",
    expirationDate: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  });
  try {
    await session.defaultSession.cookies.flushStore();
  } catch {
    /* older Electron */
  }
}

async function restoreCloudSession() {
  const origin = deskOrigin();
  const refresh = readStoredRefresh();
  if (!refresh) return;
  try {
    const res = await fetchWithTimeout(
      `${origin}/api/auth/refresh`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-cinem-client": "desktop" },
        body: JSON.stringify({ refreshToken: refresh, surface: "desktop" }),
      },
      8000,
    );
    const data = await res.json();
    if (!res.ok || !data.accessToken) return;
    if (data.refreshToken) writeStoredRefresh(data.refreshToken);
    await setSessionCookieOnOrigin(origin, data.accessToken);
  } catch (error) {
    console.error("CINEM desktop session restore failed", error);
  }
}

async function finishConnect(origin, nonce) {
  if (!nonce) return;
  const base = String(origin || deskOrigin()).replace(/\/$/, "");
  const res = await fetchWithTimeout(
    `${base}/api/auth/connect/claim`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-cinem-client": "desktop" },
      body: JSON.stringify({ nonce }),
    },
    8000,
  );
  const data = await res.json();
  if (!res.ok || !data.accessToken) {
    console.error("CINEM desktop connect claim failed", data.error || res.status);
    return;
  }
  if (data.refreshToken) writeStoredRefresh(data.refreshToken);
  await setSessionCookieOnOrigin(base, data.accessToken);
  const pathName = data.workspaceId ? `/desk/${data.workspaceId}` : "/desk";
  await showMode("desk", pathName);
}

function handleProtocolUrl(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname || url.host;
    const action = host || url.pathname.replace(/^\//, "").split("/")[0];
    if (action === "connect") {
      void finishConnect(url.searchParams.get("origin") || deskOrigin(), url.searchParams.get("nonce"));
      return;
    }
    const mode = modeFromProtocolUrl(raw);
    if (mode === "assistant" || mode === "both") {
      void showMode(mode);
      return;
    }
    if (action === "open" || action === "desk") {
      void showMode("desk", url.searchParams.get("path") || "/desk");
    }
  } catch (error) {
    console.error("CINEM desktop deep link failed", error);
  }
}

async function boot() {
  // Never apply userData APP_URL=127.0.0.1 onto a packaged cloud session.
  if (packaged() && !useCloudDesk()) {
    applyUserEnv();
  } else if (!packaged() && !useCloudDesk()) {
    process.env.PORT = String(PORT);
    process.env.HOSTNAME = HOST;
    if (!process.env.OAUTH_REDIRECT_BASE) process.env.OAUTH_REDIRECT_BASE = ORIGIN;
  }

  if (!useCloudDesk()) {
    const already = await ping();
    if (!already) {
      spawnedServer = true;
      if (packaged()) startPackagedServer();
      else startDevServer();
      await waitForServer();
    }
  }

  try {
    startNativeAgent();
  } catch (error) {
    console.error("CINEM local agent did not start", error);
  }

  await restoreCloudSession();
  const startMode = parseStartMode(process.argv, process.env);
  if (startMode === "both") {
    createShellWindow("desk");
    createShellWindow("assistant");
  } else {
    createShellWindow(startMode);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const proto = argv.find((arg) => typeof arg === "string" && arg.startsWith(`${PROTOCOL}:`));
    if (proto) handleProtocolUrl(proto);
    const mode = parseStartMode(argv, {});
    if (mode === "assistant" || mode === "both") {
      void showMode(mode);
    }
    const focused = firstShell();
    if (focused) {
      if (focused.win.isMinimized()) focused.win.restore();
      focused.win.focus();
    }
  });

function installAppMenu() {
  const template = [
    ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
    {
      label: "CINEM Pro",
      submenu: [
        {
          label: "Desk",
          accelerator: "CmdOrCtrl+1",
          click: () => {
            void showMode("desk");
          },
        },
        {
          label: "AI Assistant",
          accelerator: "CmdOrCtrl+2",
          click: () => {
            void showMode("assistant");
          },
        },
        {
          label: "Open both",
          accelerator: "CmdOrCtrl+Shift+B",
          click: () => {
            void openBoth();
          },
        },
        { type: "separator" },
        {
          label: "Settings",
          accelerator: "CmdOrCtrl+,",
          click: () => {
            void showMode("desk", "/desk");
          },
        },
        {
          label: "Updates",
          click: () => {
            openUpdatesWindow();
          },
        },
        {
          label: "Sign in with CINEM",
          click: () => {
            void showMode("desk", "/connect/desktop");
          },
        },
        {
          label: "Open in browser",
          click: () => {
            void shell.openExternal(`${deskOrigin()}/desk`);
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    {
      label: "Trust",
      submenu: [
        {
          label: "Privacy",
          click: () => {
            void showMode("desk", "/privacy");
          },
        },
        {
          label: "DPA template",
          click: () => {
            void showMode("desk", "/dpa");
          },
        },
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Updates",
          click: () => {
            openUpdatesWindow();
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

  app.whenReady().then(() => {
    app.setName("CINEM Pro");
    const ua = chromeUserAgent(app.userAgentFallback || session.defaultSession.getUserAgent());
    if (ua) {
      app.userAgentFallback = ua;
      session.defaultSession.setUserAgent(ua);
    }
    if (process.platform === "win32") {
      app.setAppUserModelId("com.brandcrew.desktop");
    }
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(permission === "media" || permission === "mediaKeySystem" || permission === "clipboard-sanitized-write");
    });
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
      }
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL);
    }
    installAppMenu();
    startAutoUpdates({
      extraContents() {
        const list = [];
        for (const entry of shells.values()) {
          if (entry.view && entry.view.webContents && !entry.view.webContents.isDestroyed()) {
            list.push(entry.view.webContents);
          }
        }
        return list;
      },
    });
    ipcMain.on("cinem:retry-desk", (event) => {
      const entry = shellFromContents(event.sender) || firstShell();
      void applyMode(entry, "desk");
    });
    ipcMain.on("cinem:open-desk-external", () => {
      void shell.openExternal(`${deskOrigin()}/desk`);
    });
    ipcMain.on("cinem:set-mode", (event, mode) => {
      const entry = shellFromContents(event.sender);
      const next = normalizeMode(mode);
      if (next === "both") {
        void openBoth();
        return;
      }
      if (entry) {
        void applyMode(entry, next);
        return;
      }
      void showMode(next);
    });
    ipcMain.on("cinem:open-both", () => {
      void openBoth();
    });
    ipcMain.handle("cinem:open-external", async (_event, url) => {
      if (!isHttpUrl(url)) return false;
      await shell.openExternal(String(url));
      return true;
    });
    ipcMain.handle("cinem:verify-shell", (_event, nonce) => verifyShellNonce(nonce));
    ipcMain.handle("cinem:ping", () => ASSISTANT_PING);
    ipcMain.handle("cinem:get-session", () => ({
      refreshToken: readStoredRefresh(),
    }));
    ipcMain.handle("cinem:store-session", (_event, payload) => {
      const token = payload && typeof payload.refreshToken === "string" ? payload.refreshToken.trim() : "";
      if (token) writeStoredRefresh(token);
      return { ok: true };
    });
    const guardedContents = new WeakSet();
    app.on("web-contents-created", (_event, contents) => {
      const chromeUa = chromeUserAgent(contents.getUserAgent());
      if (chromeUa) contents.setUserAgent(chromeUa);
      if (guardedContents.has(contents)) return;
      guardedContents.add(contents);
      attachNavigationGuards(contents);
    });
    const protoArg = process.argv.find((arg) => typeof arg === "string" && arg.startsWith(`${PROTOCOL}:`));
    if (protoArg) {
      app.once("browser-window-created", () => handleProtocolUrl(protoArg));
    }
    return boot().catch((error) => {
      console.error(error);
      if (useCloudDesk()) {
        if (shells.size === 0) createShellWindow("desk");
        const entry = firstShell();
        if (entry) showOfflinePage(entry);
        if (entry && !entry.win.isDestroyed()) entry.win.show();
        return;
      }
      dialog.showErrorBox("CINEM Pro", error instanceof Error ? error.message : String(error));
      app.quit();
    });
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createShellWindow("desk");
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleProtocolUrl(url);
});

app.on("before-quit", () => {
  if (spawnedServer && serverChild && !serverChild.killed) {
    serverChild.kill();
    serverChild = null;
  }
  if (nativeChild && !nativeChild.killed) {
    nativeChild.kill();
    nativeChild = null;
  }
});
