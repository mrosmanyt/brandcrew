/**
 * CINEM Pro Windows auto-update (electron-updater + public GitHub Releases).
 * Feed: https://github.com/mrosmanyt/cinem-pro-releases (anonymous latest.yml).
 * NSIS Setup.exe is the update path. Portable / desktop:dev cannot apply updates.
 */
const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const FEED_OWNER = "mrosmanyt";
const FEED_REPO = "cinem-pro-releases";
const FEED_URL = `https://github.com/${FEED_OWNER}/${FEED_REPO}`;
const PREFS_NAME = "update-prefs.json";
const LAUNCH_CHECK_MS = 8_000;
const PERIODIC_CHECK_MS = 4 * 60 * 60 * 1000;

/** @typedef {"idle" | "checking" | "none" | "available" | "downloading" | "ready" | "error"} UpdateStatus */
/** @typedef {"nsis" | "portable" | "dev"} UpdateChannel */

/** @type {{
 *   status: UpdateStatus,
 *   currentVersion: string,
 *   version: string,
 *   notes: string,
 *   progress: number,
 *   error: string,
 *   autoUpdate: boolean,
 *   channel: UpdateChannel,
 *   feed: string,
 * }} */
const state = {
  status: "idle",
  currentVersion: "",
  version: "",
  notes: "",
  progress: 0,
  error: "",
  autoUpdate: true,
  channel: "dev",
  feed: FEED_URL,
};

/** @type {import("electron-updater").AppUpdater | null} */
let autoUpdater = null;
/** @type {import("electron").BrowserWindow | null} */
let updatesWindow = null;
/** @type {(() => import("electron").WebContents[]) | null} */
let extraContents = null;
let ipcInstalled = false;
/** @type {ReturnType<typeof setInterval> | null} */
let periodicTimer = null;
let checking = false;

function isPortableBuild() {
  return Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
}

function resolveChannel() {
  if (!app.isPackaged) return "dev";
  if (isPortableBuild()) return "portable";
  return "nsis";
}

function prefsPath() {
  return path.join(app.getPath("userData"), PREFS_NAME);
}

function readPrefs() {
  try {
    const raw = JSON.parse(fs.readFileSync(prefsPath(), "utf8"));
    return { autoUpdate: raw.autoUpdate !== false };
  } catch {
    return { autoUpdate: true };
  }
}

function writePrefs(prefs) {
  fs.mkdirSync(path.dirname(prefsPath()), { recursive: true });
  fs.writeFileSync(prefsPath(), `${JSON.stringify(prefs, null, 2)}\n`);
}

function snapshot() {
  return {
    ...state,
    currentVersion: app.getVersion(),
  };
}

function broadcast() {
  const payload = snapshot();
  const seen = new WeakSet();
  const send = (contents) => {
    if (!contents || contents.isDestroyed() || seen.has(contents)) return;
    seen.add(contents);
    try {
      contents.send("cinem:update:status", payload);
    } catch {
      /* renderer gone */
    }
  };
  for (const win of BrowserWindow.getAllWindows()) {
    send(win.webContents);
  }
  if (typeof extraContents === "function") {
    for (const contents of extraContents() || []) send(contents);
  }
}

function setState(partial) {
  Object.assign(state, partial);
  broadcast();
}

function channelMessage(channel) {
  if (channel === "portable") {
    return "Portable builds cannot auto-update. Install CINEM Pro with CINEM-Pro-Setup.exe to receive updates.";
  }
  if (channel === "dev") {
    return "Updates are checked in the installed CINEM Pro app (CINEM-Pro-Setup.exe), not in desktop:dev.";
  }
  return "";
}

function loadAutoUpdater() {
  try {
    return require("electron-updater").autoUpdater;
  } catch (error) {
    console.error("CINEM Pro electron-updater is missing", error);
    return null;
  }
}

function bindAutoUpdater(instance) {
  instance.autoDownload = state.autoUpdate;
  instance.autoInstallOnAppQuit = state.autoUpdate;
  instance.allowDowngrade = false;
  instance.disableWebInstaller = true;
  // Public feed — no client token. Do not set publisherName (builds are unsigned).
  instance.setFeedURL({
    provider: "github",
    owner: FEED_OWNER,
    repo: FEED_REPO,
  });

  instance.on("checking-for-update", () => {
    setState({ status: "checking", error: "" });
  });
  instance.on("update-available", (info) => {
    const notes =
      typeof info.releaseNotes === "string"
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map((item) => item.note || "").join("\n")
          : "";
    setState({
      status: "available",
      version: info.version || "",
      notes,
      error: "",
    });
  });
  instance.on("update-not-available", () => {
    checking = false;
    setState({ status: "none", version: "", notes: "", error: "" });
  });
  instance.on("download-progress", (progress) => {
    const percent = typeof progress.percent === "number" ? progress.percent : 0;
    setState({ status: "downloading", progress: Math.min(1, percent / 100) });
  });
  instance.on("update-downloaded", (info) => {
    checking = false;
    setState({
      status: "ready",
      progress: 1,
      version: info.version || state.version,
      error: "",
    });
  });
  instance.on("error", (error) => {
    checking = false;
    setState({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

async function checkForUpdates(opts = {}) {
  const channel = resolveChannel();
  state.channel = channel;
  const blocked = channelMessage(channel);
  if (blocked) {
    if (opts.silent) {
      setState({ status: "idle", error: "", channel });
    } else {
      setState({ status: "error", error: blocked, channel });
    }
    return snapshot();
  }
  if (!autoUpdater) {
    setState({ status: "error", error: "Updater is not initialized.", channel });
    return snapshot();
  }
  if (checking || state.status === "downloading") {
    return snapshot();
  }
  checking = true;
  setState({ status: "checking", error: "", channel });
  try {
    autoUpdater.autoDownload = state.autoUpdate && opts.auto !== false;
    await autoUpdater.checkForUpdates();
  } catch (error) {
    checking = false;
    if (opts.silent) {
      setState({ status: "idle", error: "" });
    } else {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return snapshot();
}

async function downloadUpdate() {
  if (!autoUpdater) return snapshot();
  if (state.channel !== "nsis") {
    setState({ status: "error", error: channelMessage(state.channel) || "Download is not available." });
    return snapshot();
  }
  try {
    setState({ status: "downloading", progress: state.progress || 0, error: "" });
    await autoUpdater.downloadUpdate();
  } catch (error) {
    setState({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return snapshot();
}

function installAndRestart() {
  if (!autoUpdater || state.channel !== "nsis") {
    return { ok: false };
  }
  // Show the NSIS UI so UAC / SmartScreen can appear on unsigned builds.
  autoUpdater.quitAndInstall(false, true);
  return { ok: true };
}

function setAutoUpdate(enabled) {
  const autoUpdate = enabled !== false;
  state.autoUpdate = autoUpdate;
  writePrefs({ autoUpdate });
  if (autoUpdater) {
    autoUpdater.autoDownload = autoUpdate;
    autoUpdater.autoInstallOnAppQuit = autoUpdate;
  }
  broadcast();
  return snapshot();
}

function openUpdatesWindow() {
  if (updatesWindow && !updatesWindow.isDestroyed()) {
    updatesWindow.focus();
    return updatesWindow;
  }
  const parent = BrowserWindow.getFocusedWindow();
  const icon = packagedIcon();
  updatesWindow = new BrowserWindow({
    width: 460,
    height: 560,
    minWidth: 400,
    minHeight: 480,
    parent: parent && !parent.isDestroyed() ? parent : undefined,
    title: "Updates — CINEM Pro",
    backgroundColor: "#09090b",
    autoHideMenuBar: true,
    minimizable: false,
    fullscreenable: false,
    show: false,
    icon: icon && fs.existsSync(icon) ? icon : undefined,
    webPreferences: {
      preload: path.join(__dirname, "updates-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  updatesWindow.once("ready-to-show", () => {
    if (updatesWindow && !updatesWindow.isDestroyed()) updatesWindow.show();
  });
  updatesWindow.on("closed", () => {
    updatesWindow = null;
  });
  void updatesWindow.loadFile(path.join(__dirname, "updates.html"));
  return updatesWindow;
}

function packagedIcon() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "brandcrew", "icon.png");
  }
  return path.join(__dirname, "resources", "icon.png");
}

function registerUpdateIpc() {
  if (ipcInstalled) return;
  ipcInstalled = true;
  ipcMain.handle("cinem:update:get", () => snapshot());
  ipcMain.handle("cinem:update:check", (_event, opts) => checkForUpdates(opts || {}));
  ipcMain.handle("cinem:update:download", () => downloadUpdate());
  ipcMain.handle("cinem:update:install", () => installAndRestart());
  ipcMain.handle("cinem:update:set-auto", (_event, enabled) => setAutoUpdate(enabled));
  ipcMain.on("cinem:open-updates", () => {
    openUpdatesWindow();
  });
}

/**
 * @param {{ extraContents?: () => import("electron").WebContents[] }} [opts]
 */
function startAutoUpdates(opts = {}) {
  extraContents = typeof opts.extraContents === "function" ? opts.extraContents : null;
  const prefs = readPrefs();
  state.autoUpdate = prefs.autoUpdate;
  state.currentVersion = app.getVersion();
  state.channel = resolveChannel();
  registerUpdateIpc();

  if (state.channel !== "nsis") {
    return;
  }

  autoUpdater = loadAutoUpdater();
  if (!autoUpdater) {
    setState({ status: "error", error: "Updater module is not available in this build." });
    return;
  }
  bindAutoUpdater(autoUpdater);

  setTimeout(() => {
    void checkForUpdates({ silent: true, auto: true });
  }, LAUNCH_CHECK_MS);

  periodicTimer = setInterval(() => {
    if (!state.autoUpdate) return;
    if (state.status === "checking" || state.status === "downloading" || state.status === "ready") {
      return;
    }
    void checkForUpdates({ silent: true, auto: true });
  }, PERIODIC_CHECK_MS);
  if (periodicTimer && typeof periodicTimer.unref === "function") {
    periodicTimer.unref();
  }
}

module.exports = {
  FEED_OWNER,
  FEED_REPO,
  FEED_URL,
  startAutoUpdates,
  openUpdatesWindow,
  checkForUpdates,
  setAutoUpdate,
};
