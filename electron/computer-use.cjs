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
  try {
    if (!hudWindow || hudWindow.isDestroyed()) return;
    hudWindow.webContents.send("cinem:computer-use:hud", payload);
  } catch (error) {
    console.error("[computer-use] pushHud failed", error);
  }
}

function showHud() {
  try {
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
  } catch (error) {
    console.error("[computer-use] showHud failed", error);
    return null;
  }
}

function hideHud() {
  try {
    if (hudWindow && !hudWindow.isDestroyed()) {
      hudWindow.close();
    }
  } catch (error) {
    console.error("[computer-use] hideHud failed", error);
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
  try {
    if (assistantWebContents && !assistantWebContents.isDestroyed()) {
      assistantWebContents.send(channel, payload);
    }
  } catch (error) {
    console.error("[computer-use] notifyRenderer failed", channel, error);
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
  try {
    const ok = globalShortcut.register("Control+Alt+Escape", () => {
      terminateSession("hotkey");
    });
    return ok;
  } catch (error) {
    console.error("[computer-use] registerKillShortcut failed", error);
    return false;
  }
}

function unregisterKillShortcut() {
  try {
    globalShortcut.unregister("Control+Alt+Escape");
  } catch {
    /* ignore */
  }
}

function startSidecar() {
  if (!isEnvEnabled()) {
    return { ok: false, error: "Computer use is disabled (set COMPUTER_USE_ENABLED=1)." };
  }
  if (sidecarChild && !sidecarChild.killed) return { ok: true };
  const entry = sidecarEntry();
  if (!fs.existsSync(entry)) {
    return { ok: false, error: `Sidecar not found: ${entry}` };
  }
  try {
    sidecarChild = spawn(process.execPath, [entry], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: "ignore",
      windowsHide: true,
    });
    sidecarChild.on("exit", () => {
      sidecarChild = null;
    });
    return { ok: true };
  } catch (error) {
    console.error("[computer-use] startSidecar failed", error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function terminateSession(reason) {
  try {
    sessionActive = false;
    sessionStatus = "terminated";
    stopMousePoll();
    pushHud({ status: "terminated", currentAction: reason || "terminated" });
    notifyRenderer("cinem:computer-use:terminated", { reason });
    unregisterKillShortcut();
    setTimeout(() => hideHud(), 1500);
  } catch (error) {
    console.error("[computer-use] terminateSession failed", error);
  }
}

function startSession(webContents, payload) {
  if (!isEnvEnabled()) {
    return { ok: false, error: "Computer use is disabled (set COMPUTER_USE_ENABLED=1)." };
  }
  assistantWebContents = webContents;
  sessionActive = true;
  sessionStatus = "working";
  mousePausedThisGesture = false;
  showHud();
  registerKillShortcut();
  const sidecar = startSidecar();
  if (!sidecar.ok) {
    terminateSession(sidecar.error || "sidecar_offline");
    return sidecar;
  }
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
  try {
    if (payload?.status) sessionStatus = payload.status;
    if (payload?.status === "working") mousePausedThisGesture = false;
    pushHud(payload || {});
    return { ok: true };
  } catch (error) {
    console.error("[computer-use] syncHud failed", error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function stopSession() {
  try {
    sessionActive = false;
    sessionStatus = "idle";
    stopMousePoll();
    unregisterKillShortcut();
    pushHud({ status: "idle", currentAction: "Session complete" });
    setTimeout(() => hideHud(), 2000);
    return { ok: true };
  } catch (error) {
    console.error("[computer-use] stopSession failed", error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function isEnvEnabled() {
  const v = String(process.env.COMPUTER_USE_ENABLED || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function safeHandle(handler) {
  return (...args) => {
    try {
      return handler(...args);
    } catch (error) {
      console.error("[computer-use] ipc handler failed", error);
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  };
}

function registerIpc(ipcMain) {
  ipcMain.handle("cinem:computer-use:env-enabled", safeHandle(() => isEnvEnabled()));
  ipcMain.handle("cinem:computer-use:start-sidecar", safeHandle(() => startSidecar()));
  ipcMain.handle(
    "cinem:computer-use:start-session",
    safeHandle((event, payload) => startSession(event.sender, payload)),
  );
  ipcMain.handle("cinem:computer-use:sync-hud", safeHandle((_event, payload) => syncHud(payload)));
  ipcMain.handle(
    "cinem:computer-use:terminate",
    safeHandle(() => {
      terminateSession("ui");
      return { ok: true };
    }),
  );
  ipcMain.handle("cinem:computer-use:stop-session", safeHandle(() => stopSession()));
}

function cleanup() {
  try {
    stopMousePoll();
    unregisterKillShortcut();
    hideHud();
    if (sidecarChild && !sidecarChild.killed) {
      sidecarChild.kill();
      sidecarChild = null;
    }
  } catch (error) {
    console.error("[computer-use] cleanup failed", error);
  }
}

module.exports = {
  registerIpc,
  cleanup,
  isEnvEnabled,
  MOUSE_THRESHOLD_PX,
};
