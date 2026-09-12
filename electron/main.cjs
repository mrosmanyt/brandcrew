/**
 * CINEM Pro desktop shell.
 * Packaged default: cloud desk at https://app.cinem.tech (same as the website).
 * Local Next + Postgres only when CINEM_DESK_MODE=local (or unpackaged desktop:dev).
 */
const { app, BrowserWindow, Menu, shell, dialog, session, ipcMain } = require("electron");
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
let mainWindow = null;
let showingOffline = false;

function projectRoot() {
  return path.join(__dirname, "..");
}

function offlinePagePath() {
  return path.join(__dirname, "offline.html");
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
  return { deskOrigin: deskOrigin(), localOrigin: localLoopbackOrigin() };
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

function showOfflinePage() {
  if (!mainWindow || mainWindow.isDestroyed() || showingOffline) return;
  const file = offlinePagePath();
  if (!fs.existsSync(file)) return;
  showingOffline = true;
  void mainWindow.loadFile(file);
}

function loadDesk(pathName = "/desk") {
  if (!mainWindow || mainWindow.isDestroyed()) return Promise.resolve();
  showingOffline = false;
  const url = `${deskOrigin()}${deskPath(pathName)}`;
  return mainWindow.loadURL(url).catch((error) => {
    const code = error && (error.errno ?? error.code);
    if (isIgnorableLoadError(code) || code === "ERR_ABORTED") return;
    console.error("CINEM desktop desk load failed", error);
    showOfflinePage();
  });
}

function createWindow() {
  const icon = packaged()
    ? path.join(process.resourcesPath, "brandcrew", "icon.png")
    : path.join(projectRoot(), "electron", "resources", "icon.png");

  const ua = chromeUserAgent(app.userAgentFallback || session.defaultSession.getUserAgent());

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    title: "CINEM Pro",
    backgroundColor: "#09090b",
    autoHideMenuBar: true,
    show: false,
    icon: fs.existsSync(icon) ? icon : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      userAgent: ua,
    },
  });

  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || isIgnorableLoadError(errorCode)) return;
      if (validatedURL && String(validatedURL).startsWith("file:")) return;
      console.error("CINEM desktop did-fail-load", errorCode, errorDescription);
      showOfflinePage();
    },
  );

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    if (details.reason === "clean-exit") return;
    console.error("CINEM desktop renderer gone", details.reason);
    showOfflinePage();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
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
  await loadDesk(pathName);
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
    if (action === "open") {
      void loadDesk(url.searchParams.get("path") || "/desk");
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

  createWindow();
  await restoreCloudSession();
  await loadDesk("/desk");
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const proto = argv.find((arg) => typeof arg === "string" && arg.startsWith(`${PROTOCOL}:`));
    if (proto) handleProtocolUrl(proto);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

function installAppMenu() {
  const template = [
    ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
    {
      label: "CINEM Pro",
      submenu: [
        {
          label: "Settings",
          accelerator: "CmdOrCtrl+,",
          click: () => {
            void loadDesk("/desk");
          },
        },
        {
          label: "Sign in with CINEM",
          click: () => {
            void loadDesk("/connect/desktop");
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
            void loadDesk("/privacy");
          },
        },
        {
          label: "DPA template",
          click: () => {
            void loadDesk("/dpa");
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
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
      }
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL);
    }
    installAppMenu();
    ipcMain.on("cinem:retry-desk", () => {
      void loadDesk("/desk");
    });
    ipcMain.on("cinem:open-desk-external", () => {
      void shell.openExternal(`${deskOrigin()}/desk`);
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
        if (!mainWindow) createWindow();
        showOfflinePage();
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
        return;
      }
      dialog.showErrorBox("CINEM Pro", error instanceof Error ? error.message : String(error));
      app.quit();
    });
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      void loadDesk("/desk");
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
