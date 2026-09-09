/**
 * CINEM Pro desktop shell.
 * Dev: spawn `npm run dev` (or attach if :port is already up) and load it.
 * Packaged: fork Next standalone server.js with ELECTRON_RUN_AS_NODE,
 * Postgres + .env in the OS userData directory (same DATABASE_URL as web).
 */
const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn, fork } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.BRANDCREW_PORT || 43180);
const HOST = "127.0.0.1";
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
    if (url.startsWith(ORIGIN)) return { action: "allow" };
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow.loadURL(ORIGIN);
}

async function boot() {
  if (packaged()) {
    applyUserEnv();
  } else {
    process.env.PORT = String(PORT);
    process.env.HOSTNAME = HOST;
    if (!process.env.OAUTH_REDIRECT_BASE) process.env.OAUTH_REDIRECT_BASE = ORIGIN;
  }

  const already = await ping();
  if (!already) {
    spawnedServer = true;
    if (packaged()) startPackagedServer();
    else startDevServer();
    await waitForServer();
  }

  try {
    startNativeAgent();
  } catch (error) {
    console.error("CINEM local agent did not start", error);
  }

  await createWindow();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setName("CINEM Pro");
    if (process.platform === "win32") {
      app.setAppUserModelId("com.brandcrew.desktop");
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
