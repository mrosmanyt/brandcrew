/**
 * CINEM Pro desktop shell.
 * Dev: spawn `npm run dev` (or attach if :port is already up) and load it.
 * Packaged: fork Next standalone server.js with ELECTRON_RUN_AS_NODE,
 * Postgres + .env in the OS userData directory (same DATABASE_URL as web).
 */
const { app, BrowserWindow, Menu, shell, dialog, session } = require("electron");
const { spawn, fork } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.BRANDCREW_PORT || 43180);
const HOST = "127.0.0.1";
const ORIGIN = `http://${HOST}:${PORT}`;
const PROTOCOL = "cinem-pro";
const SESSION_COOKIE = "brandcrew_session";

function cloudOrigin() {
  const raw =
    process.env.CINEM_CLOUD_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://app.cinem.tech";
  return String(raw).replace(/\/$/, "");
}

function useCloudDesk() {
  if (process.env.CINEM_DESK_MODE === "local") return false;
  if (process.env.CINEM_DESK_MODE === "cloud") return true;
  return packaged();
}

function deskOrigin() {
  return useCloudDesk() ? cloudOrigin() : ORIGIN;
}

function isAllowedNavigation(url) {
  try {
    const parsed = new URL(url);
    const desk = deskOrigin();
    if (url.startsWith(desk) || url.startsWith(ORIGIN)) return true;
    const host = parsed.hostname;
    return (
      host === "accounts.google.com" ||
      host.endsWith(".google.com") ||
      host.endsWith(".cinem.tech") ||
      host === "brandcrew.vercel.app"
    );
  } catch {
    return false;
  }
}

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

function projectRoot() {
  return path.join(__dirname, "..");
}

function packaged() {
  return app.isPackaged;
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
    "# CINEM Pro desktop environment",
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

function createWindow() {
  const icon = packaged()
    ? path.join(process.resourcesPath, "brandcrew", "icon.png")
    : path.join(projectRoot(), "electron", "resources", "icon.png");

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    title: "CINEM Pro",
    backgroundColor: "#09090b",
    autoHideMenuBar: true,
    icon: fs.existsSync(icon) ? icon : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(url)) return { action: "allow" };
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAllowedNavigation(url)) return;
    event.preventDefault();
    void shell.openExternal(url);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow.loadURL(`${deskOrigin()}/desk`);
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
  });
}

async function restoreCloudSession() {
  const origin = deskOrigin();
  const refresh = readStoredRefresh();
  if (!refresh) return;
  try {
    const res = await fetch(`${origin}/api/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-cinem-client": "desktop" },
      body: JSON.stringify({ refreshToken: refresh, surface: "desktop" }),
    });
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
  const res = await fetch(`${base}/api/auth/connect/claim`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-cinem-client": "desktop" },
    body: JSON.stringify({ nonce }),
  });
  const data = await res.json();
  if (!res.ok || !data.accessToken) {
    console.error("CINEM desktop connect claim failed", data.error || res.status);
    return;
  }
  if (data.refreshToken) writeStoredRefresh(data.refreshToken);
  await setSessionCookieOnOrigin(base, data.accessToken);
  const pathName = data.workspaceId ? `/desk/${data.workspaceId}` : "/desk";
  if (mainWindow) void mainWindow.loadURL(`${base}${pathName}`);
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
      const next = url.searchParams.get("path") || "/desk";
      const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/desk";
      if (mainWindow) void mainWindow.loadURL(`${deskOrigin()}${safe}`);
    }
  } catch (error) {
    console.error("CINEM desktop deep link failed", error);
  }
}

async function boot() {
  if (packaged() && !useCloudDesk()) {
    applyUserEnv();
  } else if (!packaged()) {
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
  await createWindow();
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
            if (mainWindow) void mainWindow.loadURL(`${deskOrigin()}/desk`);
          },
        },
        {
          label: "Sign in with CINEM",
          click: () => {
            if (mainWindow) void mainWindow.loadURL(`${deskOrigin()}/connect/desktop`);
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
            if (mainWindow) void mainWindow.loadURL(`${deskOrigin()}/privacy`);
          },
        },
        {
          label: "DPA template",
          click: () => {
            if (mainWindow) void mainWindow.loadURL(`${deskOrigin()}/dpa`);
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

  app.whenReady().then(() => {
    app.setName("CINEM Pro");
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
    const protoArg = process.argv.find((arg) => typeof arg === "string" && arg.startsWith(`${PROTOCOL}:`));
    if (protoArg) {
      app.once("browser-window-created", () => handleProtocolUrl(protoArg));
    }
    return boot().catch((error) => {
      console.error(error);
      dialog.showErrorBox("CINEM Pro", error instanceof Error ? error.message : String(error));
      app.quit();
    });
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
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
