/**
 * Electron main-process computer-use controller.
 * - Always-on-top HUD window
 * - Global kill switch Ctrl+Alt+Esc
 * - Mouse-move pause detection while session is working
 * - Spawns computer-use-server sidecar on demand
 */
const { BrowserWindow, globalShortcut, screen } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");
const fs = require("node:fs");

const MOUSE_THRESHOLD_PX = 12;
const MOUSE_POLL_MS = 200;

/** @type {import('electron').BrowserWindow | null} */
let hudWindow = null;
/** @type {import('electron').WebContents | null} */
let assistantWebContents = null;
/** @type {import('child_process').ChildProcess | null} */
let sidecarChild = null;

let sessionActive = false;
let sessionStatus = "idle";
let mousePollTimer = null;
let lastMouse = { x: -1, y: -1 };
let mousePausedThisGesture = false;

function hudHtmlPath() {
  return path.join(__dirname, "computer-use-hud.html");
}

function sidecarEntry() {
  const root = path.join(__dirname, "..", "apps", "cinem-ai-assistant", "computer-use-server", "index.js");
  if (fs.existsSync(root)) return root;
  const packaged = path.join(process.resourcesPath || "", "computer-use-server", "index.js");
  if (fs.existsSync(packaged)) return packaged;
  return root;
}

function pushHud(payload) {
  if (!hudWindow || hudWindow.isDestroyed()) return;
  hudWindow.webContents.send("cinem:computer-use:hud", payload);
}

function showHud() {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.show();
    return hudWindow;
  }
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  hudWindow = new BrowserWindow({
    width: 336,
    height: 130,
    x: width - 356,
    y: 24,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  hudWindow.setAlwaysOnTop(true, "screen-saver");
  hudWindow.loadFile(hudHtmlPath());
  hudWindow.once("ready-to-show", () => {
    if (hudWindow && !hudWindow.isDestroyed()) hudWindow.show();
  });
  return hudWindow;
}

function hideHud() {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.close();
  }
  hudWindow = null;
}

function stopMousePoll() {
  if (mousePollTimer) {
    clearInterval(mousePollTimer);
    mousePollTimer = null;
  }
  lastMouse = { x: -1, y: -1 };
  mousePausedThisGesture = false;
}

function notifyRenderer(channel, payload) {
  if (assistantWebContents && !assistantWebContents.isDestroyed()) {
    assistantWebContents.send(channel, payload);
  }
}

function startMousePoll() {
  stopMousePoll();
  mousePollTimer = setInterval(() => {
    if (!sessionActive || sessionStatus !== "working") return;
    const pt = screen.getCursorScreenPoint();
    if (lastMouse.x < 0) {
      lastMouse = { x: pt.x, y: pt.y };
      return;
    }
    const dx = Math.abs(pt.x - lastMouse.x);
    const dy = Math.abs(pt.y - lastMouse.y);
    if (dx + dy >= MOUSE_THRESHOLD_PX && !mousePausedThisGesture) {
      mousePausedThisGesture = true;
      sessionStatus = "paused";
      pushHud({ status: "paused", currentAction: "Paused — you moved the mouse" });
      notifyRenderer("cinem:computer-use:mouse-pause", {});
    }
    lastMouse = { x: pt.x, y: pt.y };
  }, MOUSE_POLL_MS);
}

function registerKillShortcut() {
  try {
    globalShortcut.unregister("Control+Alt+Escape");
  } catch {
    /* ignore */
  }
  const ok = globalShortcut.register("Control+Alt+Escape", () => {
    terminateSession("hotkey");
  });
  return ok;
}

function unregisterKillShortcut() {
  try {
    globalShortcut.unregister("Control+Alt+Escape");
  } catch {
    /* ignore */
  }
}

function startSidecar() {
  if (sidecarChild && !sidecarChild.killed) return { ok: true };
  const entry = sidecarEntry();
  if (!fs.existsSync(entry)) {
    return { ok: false, error: `Sidecar not found: ${entry}` };
  }
  sidecarChild = spawn(process.execPath, [entry], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: "ignore",
    windowsHide: true,
  });
  sidecarChild.on("exit", () => {
    sidecarChild = null;
  });
  return { ok: true };
}

function terminateSession(reason) {
  sessionActive = false;
  sessionStatus = "terminated";
  stopMousePoll();
  pushHud({ status: "terminated", currentAction: reason || "terminated" });
  notifyRenderer("cinem:computer-use:terminated", { reason });
  unregisterKillShortcut();
  setTimeout(() => hideHud(), 1500);
}

function startSession(webContents, payload) {
  assistantWebContents = webContents;
  sessionActive = true;
  sessionStatus = "working";
  mousePausedThisGesture = false;
  showHud();
  registerKillShortcut();
  startSidecar();
  const hud = {
    status: "working",
    task: payload?.task || "",
    currentAction: payload?.task || "Starting…",
    step: 0,
    maxSteps: payload?.maxSteps || 50,
  };
  pushHud(hud);
  startMousePoll();
  return { ok: true };
}

function syncHud(payload) {
  if (payload?.status) sessionStatus = payload.status;
  if (payload?.status === "working") mousePausedThisGesture = false;
  pushHud(payload || {});
  return { ok: true };
}

function stopSession() {
  sessionActive = false;
  sessionStatus = "idle";
  stopMousePoll();
  unregisterKillShortcut();
  pushHud({ status: "idle", currentAction: "Session complete" });
  setTimeout(() => hideHud(), 2000);
  return { ok: true };
}

function isEnvEnabled() {
  const v = String(process.env.COMPUTER_USE_ENABLED || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function registerIpc(ipcMain) {
  ipcMain.handle("cinem:computer-use:env-enabled", () => isEnvEnabled());
  ipcMain.handle("cinem:computer-use:start-sidecar", () => startSidecar());
  ipcMain.handle("cinem:computer-use:start-session", (event, payload) =>
    startSession(event.sender, payload),
  );
  ipcMain.handle("cinem:computer-use:sync-hud", (_event, payload) => syncHud(payload));
  ipcMain.handle("cinem:computer-use:terminate", () => {
    terminateSession("ui");
    return { ok: true };
  });
  ipcMain.handle("cinem:computer-use:stop-session", () => stopSession());
}

function cleanup() {
  stopMousePoll();
  unregisterKillShortcut();
  hideHud();
  if (sidecarChild && !sidecarChild.killed) {
    sidecarChild.kill();
    sidecarChild = null;
  }
}

module.exports = {
  registerIpc,
  cleanup,
  isEnvEnabled,
  MOUSE_THRESHOLD_PX,
};
