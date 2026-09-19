/**
 * CINEM Pro desktop shell.
 * Packaged default: cloud desk at https://app.cinem.tech (same as the website)
 * plus Cinem AI Assistant from the bundled Vite renderer.
 * Local Next + Postgres only when CINEM_DESK_MODE=local (or unpackaged desktop:dev).
 */
const { app, BrowserWindow, BrowserView, Menu, shell, dialog, session, ipcMain, powerMonitor } = require("electron");
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
  classifyDesktopNavigation,
  chromeUserAgent,
  isIgnorableLoadError,
  deskPath,
  fetchWithTimeout,
  applyPackagedLaunchEnv,
} = require("./desk-shell.cjs");
const localBuilder = require("./local-builder.cjs");
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
const { browserWindowChromeOptions, chromeQuery } = require("./window-chrome.cjs");
const wakeWord = require("./wake-word.cjs");
const computerUse = require("./computer-use.cjs");

const HOST = "127.0.0.1";

function packaged() {
  return app.isPackaged;
}

applyPackagedLaunchEnv({ packaged: app.isPackaged, env: process.env });

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
// Client Hints still advertise Electron after UA stripping; drop them so
// in-window Marketplace Google OAuth is not blocked as an embedded WebView.
app.commandLine.appendSwitch("disable-features", "UserAgentClientHint");
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

function modeChooserPagePath() {
  return path.join(__dirname, "mode-chooser.html");
}

function preferredModePath() {
  return path.join(app.getPath("userData"), "preferred-mode.json");
}

function readPreferredMode() {
  try {
    const raw = fs.readFileSync(preferredModePath(), "utf8");
    const parsed = JSON.parse(raw);
    const mode = parsed?.mode;
    return mode === "assistant" || mode === "desk" ? mode : null;
  } catch {
    return null;
  }
}

function writePreferredMode(mode) {
  const next = normalizeMode(mode);
  if (next === "both") return;
  fs.mkdirSync(path.dirname(preferredModePath()), { recursive: true });
  fs.writeFileSync(preferredModePath(), JSON.stringify({ mode: next, at: Date.now() }), {
    mode: 0o600,
  });
}

function showFirstLaunchChooser() {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 560,
      height: 420,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      title: "Welcome to CINEM Pro",
      ...browserWindowChromeOptions(process.platform),
      webPreferences: {
        preload: path.join(__dirname, "mode-chooser-preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    const done = (mode) => {
      if (!win.isDestroyed()) win.close();
      resolve(normalizeMode(mode) === "assistant" ? "assistant" : "desk");
    };
    ipcMain.once("cinem:mode-chooser-pick", (_event, mode) => {
      writePreferredMode(mode);
      done(mode);
    });
    win.on("closed", () => done("desk"));
    void win.loadFile(modeChooserPagePath());
  });
}

function signInPagePath() {
  return path.join(__dirname, "sign-in.html");
}

function assistantMissingPath() {
  return path.join(__dirname, "assistant-missing.html");
}

function assistantOfflinePagePath() {
  return path.join(__dirname, "assistant-offline.html");
}

function iconPath() {
  const names =
    process.platform === "win32"
      ? ["icon.ico", "installer/icon.ico", "icon.png"]
      : ["icon.png", "icon.ico"];
  const roots = packaged()
    ? [path.join(process.resourcesPath, "brandcrew"), path.join(process.resourcesPath, "brandcrew", "installer")]
    : [path.join(projectRoot(), "electron", "resources"), path.join(projectRoot(), "electron", "resources", "installer")];
  for (const root of roots) {
    for (const name of names) {
      const candidate = path.join(root, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
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

function handleDesktopNavigation(url) {
  const kind = classifyDesktopNavigation(url, navigationOpts());
  if (kind === "google-user-login") {
    void startDesktopConnect();
    return { action: "deny" };
  }
  if (kind === "allow") return { action: "allow" };
  void shell.openExternal(url);
  return { action: "deny" };
}

function attachNavigationGuards(contents) {
  contents.setWindowOpenHandler(({ url }) => handleDesktopNavigation(url));
  contents.on("will-navigate", (event, url) => {
    const kind = classifyDesktopNavigation(url, navigationOpts());
    if (kind === "allow") return;
    event.preventDefault();
    if (kind === "google-user-login") {
      void startDesktopConnect();
      return;
    }
    void shell.openExternal(url);
  });
  contents.on("will-redirect", (event, url) => {
    const kind = classifyDesktopNavigation(url, navigationOpts());
    if (kind === "allow") return;
    event.preventDefault();
    if (kind === "google-user-login") {
      void startDesktopConnect();
      return;
    }
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

function showAssistantOfflinePage(entry) {
  if (!entry || !entry.view || entry.showingOffline) return;
  const file = assistantOfflinePagePath();
  if (!fs.existsSync(file)) return;
  entry.showingOffline = true;
  void entry.view.webContents.loadFile(file);
}

function showSignInWaiting(entry) {
  if (!entry || !entry.view || entry.view.webContents.isDestroyed()) return;
  const file = signInPagePath();
  if (!fs.existsSync(file)) return;
  entry.showingOffline = false;
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
      showAssistantOfflinePage(entry);
    });
  }
  if (!packaged()) {
    return entry.view.webContents.loadURL(assistantDevOrigin(process.env)).catch(() => {
      if (fs.existsSync(assistantMissingPath())) {
        return entry.view.webContents.loadFile(assistantMissingPath());
      }
      showAssistantOfflinePage(entry);
    });
  }
  if (fs.existsSync(assistantMissingPath())) {
    return entry.view.webContents.loadFile(assistantMissingPath());
  }
  showAssistantOfflinePage(entry);
  return Promise.resolve();
}

function attachViewEvents(entry) {
  entry.view.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || isIgnorableLoadError(errorCode)) return;
      if (validatedURL && String(validatedURL).startsWith("file:")) return;
      console.error("CINEM desktop did-fail-load", errorCode, errorDescription, entry.mode);
      if (entry.mode === "desk") showOfflinePage(entry);
      else if (entry.mode === "assistant") showAssistantOfflinePage(entry);
    },
  );
  entry.view.webContents.on("render-process-gone", (_event, details) => {
    if (details.reason === "clean-exit") return;
    console.error("CINEM desktop renderer gone", details.reason, entry.mode);
    if (entry.mode === "desk") showOfflinePage(entry);
    else if (entry.mode === "assistant") showAssistantOfflinePage(entry);
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
    await restoreCloudSession({ forceRotate: false });
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
    ...browserWindowChromeOptions(process.platform),
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
  if (fs.existsSync(icon) && typeof win.setIcon === "function") {
    try {
      win.setIcon(icon);
    } catch {
      /* older Electron / non-Windows */
    }
  }

  const entry = {
    win,
    view: null,
    mode: startMode,
    showingOffline: false,
  };
  shells.set(win.id, entry);

  win.on("resize", () => layoutView(win, entry.view));
  const sendWindowState = () => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) return;
    win.webContents.send("cinem:window-state", {
      maximized: win.isMaximized(),
      fullscreen: win.isFullScreen(),
    });
  };
  win.on("maximize", sendWindowState);
  win.on("unmaximize", sendWindowState);
  win.on("enter-full-screen", sendWindowState);
  win.on("leave-full-screen", sendWindowState);
  win.on("closed", () => {
    shells.delete(win.id);
  });
  win.once("ready-to-show", () => {
    if (!win.isDestroyed()) win.show();
  });

  void win.loadFile(chromePagePath(), { query: chromeQuery(startMode, process.platform) }).then(() => {
    sendWindowState();
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
    if (next === "desk") {
      const hadCookie = await hasDeskSessionCookie();
      await restoreCloudSession({ forceRotate: false });
      const hasCookie = await hasDeskSessionCookie();
      if (deskPathName && deskPathName !== "/desk") {
        await loadDesk(deskPathName, existing);
      } else if (!hadCookie && hasCookie) {
        await loadDesk("/desk", existing);
      }
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function broadcastSession() {
  const payload = { refreshToken: readStoredRefresh() };
  for (const entry of shells.values()) {
    if (entry.win && !entry.win.isDestroyed() && !entry.win.webContents.isDestroyed()) {
      entry.win.webContents.send("cinem:session", payload);
    }
    if (entry.view && entry.view.webContents && !entry.view.webContents.isDestroyed()) {
      entry.view.webContents.send("cinem:session", payload);
    }
  }
}

async function hasDeskSessionCookie() {
  try {
    const cookies = await session.defaultSession.cookies.get({
      url: deskOrigin(),
      name: SESSION_COOKIE,
    });
    return Boolean(cookies && cookies[0] && cookies[0].value);
  } catch {
    return false;
  }
}

async function applyNativeSession({ accessToken, refreshToken, workspaceId, reloadDesk = true }) {
  const origin = deskOrigin();
  if (refreshToken) writeStoredRefresh(refreshToken);
  if (accessToken) await setSessionCookieOnOrigin(origin, accessToken);
  broadcastSession();
  if (!reloadDesk) return;
  const pathName = workspaceId ? `/desk/${workspaceId}` : "/desk";
  const desk = findShellByMode("desk");
  if (desk && desk.mode === "desk") {
    await loadDesk(pathName, desk);
  }
}

async function restoreCloudSession({ forceRotate = false } = {}) {
  const origin = deskOrigin();
  const refresh = readStoredRefresh();
  if (!refresh) return false;
  if (!forceRotate && (await hasDeskSessionCookie())) return true;
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
    if (!res.ok || !data.accessToken) return false;
    if (data.refreshToken) writeStoredRefresh(data.refreshToken);
    await setSessionCookieOnOrigin(origin, data.accessToken);
    broadcastSession();
    return true;
  } catch (error) {
    console.error("CINEM desktop session restore failed", error);
    return false;
  }
}

async function mintRefreshFromAccess(accessToken) {
  if (!accessToken || readStoredRefresh()) return;
  try {
    const res = await fetchWithTimeout(
      `${deskOrigin()}/api/auth/token`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cinem-client": "desktop",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          tokens: true,
          surface: "desktop",
          deviceName: "CINEM Pro Desk",
        }),
      },
      8000,
    );
    const data = await res.json();
    if (!res.ok || !data.refreshToken) return;
    writeStoredRefresh(data.refreshToken);
    broadcastSession();
  } catch (error) {
    console.error("CINEM desktop token mint failed", error);
  }
}

async function pollConnectClaim(nonce, origin) {
  const base = String(origin || deskOrigin()).replace(/\/$/, "");
  const deadline = Date.now() + 14 * 60 * 1000;
  while (Date.now() < deadline) {
    const res = await fetchWithTimeout(
      `${base}/api/auth/connect/claim`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-cinem-client": "desktop" },
        body: JSON.stringify({ nonce }),
      },
      8000,
    );
    const data = await res.json().catch(() => ({}));
    if (res.status === 410 || res.status === 409) {
      throw new Error(data.error || "That sign-in link expired. Try again.");
    }
    if (data && data.accessToken) return data;
    await sleep(2000);
  }
  throw new Error("That sign-in link expired. Try again.");
}

/** @type {Promise<{ ok: boolean, error?: string }> | null} */
let connectInFlight = null;

async function startDesktopConnect() {
  if (connectInFlight) return connectInFlight;
  connectInFlight = (async () => {
    const origin = deskOrigin();
    const desk = findShellByMode("desk") || firstShell();
    if (desk && desk.mode === "desk") showSignInWaiting(desk);
    try {
      const res = await fetchWithTimeout(
        `${origin}/api/auth/connect`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-cinem-client": "desktop" },
          body: JSON.stringify({
            surface: "desktop",
            deviceName: "CINEM Pro Desk",
            origin,
          }),
        },
        8000,
      );
      const data = await res.json();
      if (!res.ok || !data.nonce || !data.approveUrl) {
        throw new Error(data.error || "Could not start CINEM Pro sign-in.");
      }
      await shell.openExternal(data.approveUrl);
      const claimed = await pollConnectClaim(data.nonce, origin);
      await applyNativeSession({
        accessToken: claimed.accessToken,
        refreshToken: claimed.refreshToken,
        workspaceId: claimed.workspaceId,
      });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("CINEM desktop connect failed", error);
      return { ok: false, error: message };
    } finally {
      connectInFlight = null;
    }
  })();
  return connectInFlight;
}

async function finishConnect(origin, nonce) {
  if (!nonce) return;
  const base = String(origin || deskOrigin()).replace(/\/$/, "");
  try {
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
    await applyNativeSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      workspaceId: data.workspaceId,
    });
    const pathName = data.workspaceId ? `/desk/${data.workspaceId}` : "/desk";
    await showMode("desk", pathName);
  } catch (error) {
    console.error("CINEM desktop connect claim failed", error);
  }
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
  let startMode = parseStartMode(process.argv, process.env);
  if (startMode !== "both") {
    const saved = readPreferredMode();
    if (saved && !process.argv.some((a) => a.startsWith("--mode="))) {
      startMode = saved;
    } else if (!saved && packaged()) {
      startMode = await showFirstLaunchChooser();
    }
  }
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
          label: "Sign in with CINEM Pro",
          click: () => {
            void startDesktopConnect();
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
    if (powerMonitor?.on) {
      powerMonitor.on("suspend", () => wakeWord.setDeepSleep(true));
      powerMonitor.on("resume", () => wakeWord.setDeepSleep(false));
    }
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      const headers = { ...details.requestHeaders };
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase().startsWith("sec-ch-ua")) delete headers[key];
      }
      if (details.resourceType === "xhr" || details.resourceType === "fetch") {
        headers["x-cinem-client"] = "desktop";
      }
      callback({ requestHeaders: headers });
    });
    session.defaultSession.cookies.on("changed", (_event, cookie, _cause, removed) => {
      if (!cookie || cookie.name !== SESSION_COOKIE || removed) return;
      void mintRefreshFromAccess(cookie.value);
    });
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
      }
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL);
    }
    installAppMenu();
    try {
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
    } catch (error) {
      console.error("CINEM Pro auto-update bootstrap failed", error);
    }
    ipcMain.on("cinem:retry-desk", (event) => {
      const entry = shellFromContents(event.sender) || firstShell();
      void applyMode(entry, "desk");
    });
    ipcMain.on("cinem:retry-assistant", (event) => {
      const entry = shellFromContents(event.sender) || firstShell();
      if (!entry) return;
      void applyMode(entry, "assistant");
    });
    ipcMain.on("cinem:open-desk-external", () => {
      void shell.openExternal(`${deskOrigin()}/desk`);
    });
    ipcMain.on("cinem:set-mode", (event, mode) => {
      const entry = shellFromContents(event.sender);
      const next = normalizeMode(mode);
      if (next !== "both") writePreferredMode(next);
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
    function windowFromEvent(event) {
      return BrowserWindow.fromWebContents(event.sender);
    }
    ipcMain.on("cinem:window-min", (event) => {
      const win = windowFromEvent(event);
      if (win && !win.isDestroyed()) win.minimize();
    });
    ipcMain.on("cinem:window-max", (event) => {
      const win = windowFromEvent(event);
      if (!win || win.isDestroyed()) return;
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    });
    ipcMain.on("cinem:window-close", (event) => {
      const win = windowFromEvent(event);
      if (win && !win.isDestroyed()) win.close();
    });
    ipcMain.handle("cinem:window-state", (event) => {
      const win = windowFromEvent(event);
      if (!win || win.isDestroyed()) return { maximized: false, fullscreen: false };
      return { maximized: win.isMaximized(), fullscreen: win.isFullScreen() };
    });
    ipcMain.handle("cinem:open-external", async (_event, url) => {
      if (!isHttpUrl(url)) return false;
      await shell.openExternal(String(url));
      return true;
    });
    ipcMain.handle("cinem:http-get", async (_event, payload) => {
      const raw = payload && typeof payload.url === "string" ? payload.url : "";
      if (!isHttpUrl(raw)) return { ok: false, status: 0, text: "blocked" };
      let parsed;
      try {
        parsed = new URL(raw);
      } catch {
        return { ok: false, status: 0, text: "blocked" };
      }
      const host = parsed.hostname.toLowerCase();
      const allowed =
        host === "api.worldmonitor.app" ||
        host === "www.worldmonitor.app" ||
        host === "worldmonitor.app" ||
        host === "news.google.com" ||
        host === "hn.algolia.com";
      if (!allowed) return { ok: false, status: 0, text: "blocked host" };
      const headers = {
        Accept: "application/json, text/xml, */*",
        "User-Agent":
          chromeUserAgent(app.userAgentFallback || session.defaultSession.getUserAgent()) ||
          "CINEMPro/0.3.5",
      };
      const sentKey =
        payload && typeof payload.worldMonitorKey === "string" ? payload.worldMonitorKey.trim() : "";
      const envKey = String(
        process.env.WORLD_MONITOR_API_KEY || process.env.WORLDMONITOR_API_KEY || "",
      ).trim();
      const key = sentKey || envKey;
      if (key && host.endsWith("worldmonitor.app")) {
        headers["X-WorldMonitor-Key"] = key;
      }
      try {
        const res = await fetchWithTimeout(
          raw,
          { method: "GET", headers },
          12_000,
        );
        const text = await res.text();
        return { ok: res.ok, status: res.status, text };
      } catch (error) {
        return {
          ok: false,
          status: 0,
          text: error instanceof Error ? error.message : String(error),
        };
      }
    });
    ipcMain.handle("cinem:verify-shell", (_event, nonce) => verifyShellNonce(nonce));
    ipcMain.handle("cinem:ping", () => ASSISTANT_PING);
    ipcMain.handle("cinem:wake-word:status", () => wakeWord.engineStatus());
    ipcMain.handle("cinem:wake-word:start", (event) => {
      if (!event.sender || event.sender.isDestroyed()) return { ok: false, error: "no sender" };
      const result = wakeWord.startWakeWord(event.sender);
      const status = wakeWord.engineStatus();
      return { ok: true, engine: status.engine, nativeAvailable: status.nativeAvailable, ...result };
    });
    ipcMain.handle("cinem:wake-word:stop", () => {
      wakeWord.stopWakeWord();
      return { ok: true };
    });
    ipcMain.handle("cinem:wake-word:deep-sleep", (_event, on) => {
      wakeWord.setDeepSleep(Boolean(on));
      return { ok: true, deepSleep: Boolean(on) };
    });
    ipcMain.handle("cinem:wake-word:install-model", (_event, sourcePath) =>
      wakeWord.installWakeModel(String(sourcePath || "")),
    );
    computerUse.registerIpc(ipcMain);
    ipcMain.handle("cinem:get-session", () => ({
      refreshToken: readStoredRefresh(),
    }));
    ipcMain.handle("cinem:start-sign-in", () => startDesktopConnect());
    ipcMain.handle("cinem:pick-project-folder", async () => {
      const win = firstShell()?.win;
      const result = await dialog.showOpenDialog(win && !win.isDestroyed() ? win : undefined, {
        title: "Choose a project folder",
        properties: ["openDirectory", "createDirectory"],
      });
      if (result.canceled || !result.filePaths?.[0]) {
        return { ok: false, canceled: true };
      }
      return { ok: true, path: result.filePaths[0] };
    });
    ipcMain.handle("cinem:get-build-permission", () => localBuilder.getBuildPermission());
    ipcMain.handle("cinem:request-build-permission", (_event, folder) =>
      localBuilder.requestBuildPermission(folder),
    );
    ipcMain.handle("cinem:run-local-build", async (_event, input) =>
      localBuilder.runLocalBuild(input),
    );
    ipcMain.handle("cinem:store-session", async (_event, payload) => {
      const refresh =
        payload && typeof payload.refreshToken === "string" ? payload.refreshToken.trim() : "";
      const access =
        payload && typeof payload.accessToken === "string" ? payload.accessToken.trim() : "";
      if (refresh) writeStoredRefresh(refresh);
      if (access) {
        await setSessionCookieOnOrigin(deskOrigin(), access);
        broadcastSession();
        const desk = findShellByMode("desk");
        if (desk && desk.mode === "desk") await loadDesk("/desk", desk);
        return { ok: true };
      }
      if (refresh) {
        const ok = await restoreCloudSession({ forceRotate: false });
        if (ok) {
          const desk = findShellByMode("desk");
          if (desk && desk.mode === "desk") await loadDesk("/desk", desk);
        }
      }
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
  computerUse.cleanup();
  if (spawnedServer && serverChild && !serverChild.killed) {
    serverChild.kill();
    serverChild = null;
  }
  if (nativeChild && !nativeChild.killed) {
    nativeChild.kill();
    nativeChild = null;
  }
});
