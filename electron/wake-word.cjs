/**
 * Offline wake word for Cinem AI Assistant (Electron main process).
 * Uses Picovoice Porcupine when access key + keyword model are configured.
 * Renderer falls back to Web Speech when native engine is unavailable.
 */
const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const WAKE_FRAME_LENGTH = 512;
const WAKE_SAMPLE_RATE = 16000;

/** @type {import("@picovoice/porcupine-node").Porcupine | null} */
let porcupine = null;
/** @type {import("@picovoice/pvrecorder-node").PvRecorder | null} */
let recorder = null;
let running = false;
let deepSleep = false;
/** @type {import("electron").WebContents | null} */
let notifyTarget = null;

function userWakeDir() {
  return path.join(app.getPath("userData"), "wake-models");
}

function resolveKeywordPath() {
  const envPath = String(process.env.PORCUPINE_KEYWORD_PATH || "").trim();
  if (envPath && fs.existsSync(envPath)) return envPath;
  const bundled = path.join(__dirname, "wake-models", "hey-cinem.ppn");
  if (fs.existsSync(bundled)) return bundled;
  const userPath = path.join(userWakeDir(), "hey-cinem.ppn");
  if (fs.existsSync(userPath)) return userPath;
  return null;
}

function resolveAccessKey() {
  return String(process.env.PICOVOICE_ACCESS_KEY || process.env.PORCUPINE_ACCESS_KEY || "").trim();
}

function loadPorcupineModules() {
  try {
    const Porcupine = require("@picovoice/porcupine-node").Porcupine;
    const { PvRecorder } = require("@picovoice/pvrecorder-node");
    return { Porcupine, PvRecorder };
  } catch {
    return null;
  }
}

function engineStatus() {
  const accessKey = resolveAccessKey();
  const keywordPath = resolveKeywordPath();
  const mods = loadPorcupineModules();
  if (!mods) {
    return {
      engine: "web-speech",
      nativeAvailable: false,
      reason: "Install @picovoice/porcupine-node and @picovoice/pvrecorder-node for offline wake.",
      accessKeyConfigured: Boolean(accessKey),
      keywordPath,
    };
  }
  if (!accessKey) {
    return {
      engine: "web-speech",
      nativeAvailable: false,
      reason: "Set PICOVOICE_ACCESS_KEY in desktop env or Settings → General.",
      accessKeyConfigured: false,
      keywordPath,
    };
  }
  if (!keywordPath) {
    return {
      engine: "web-speech",
      nativeAvailable: false,
      reason:
        'Place hey-cinem.ppn in userData/wake-models/ (train at console.picovoice.ai for "Hey Cinem").',
      accessKeyConfigured: true,
      keywordPath: null,
    };
  }
  return {
    engine: "porcupine",
    nativeAvailable: true,
    reason: "Offline Porcupine listening for Hey Cinem.",
    accessKeyConfigured: true,
    keywordPath,
  };
}

function stopNative() {
  running = false;
  try {
    recorder?.stop();
  } catch {
    /* ignore */
  }
  try {
    recorder?.release();
  } catch {
    /* ignore */
  }
  recorder = null;
  try {
    porcupine?.release();
  } catch {
    /* ignore */
  }
  porcupine = null;
}

function startNativeLoop() {
  if (running || deepSleep || !notifyTarget || notifyTarget.isDestroyed()) return;
  const status = engineStatus();
  if (!status.nativeAvailable) return;

  const mods = loadPorcupineModules();
  if (!mods) return;
  const accessKey = resolveAccessKey();
  const keywordPath = resolveKeywordPath();
  if (!accessKey || !keywordPath) return;

  stopNative();
  try {
    porcupine = new mods.Porcupine(accessKey, [keywordPath], [0.55]);
    recorder = new mods.PvRecorder(-1, porcupine.frameLength);
    recorder.start();
    running = true;

    const loop = () => {
      if (!running || deepSleep || !porcupine || !recorder) return;
      try {
        const frame = recorder.read();
        const index = porcupine.process(frame);
        if (index >= 0 && notifyTarget && !notifyTarget.isDestroyed()) {
          notifyTarget.send("cinem:wake-word", { phrase: "hey cinem", engine: "porcupine" });
        }
      } catch {
        /* mic blip — keep listening */
      }
      setImmediate(loop);
    };
    loop();
  } catch (error) {
    stopNative();
    return { ok: false, error: error instanceof Error ? error.message : "Porcupine failed to start." };
  }
  return { ok: true };
}

function setDeepSleep(on) {
  deepSleep = Boolean(on);
  if (deepSleep) stopNative();
  else if (notifyTarget) startNativeLoop();
}

function startWakeWord(target) {
  notifyTarget = target;
  deepSleep = false;
  return startNativeLoop() ?? { ok: engineStatus().nativeAvailable };
}

function stopWakeWord() {
  notifyTarget = null;
  stopNative();
}

function installWakeModel(sourcePath) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return { ok: false, error: "Model file not found." };
  }
  fs.mkdirSync(userWakeDir(), { recursive: true });
  const dest = path.join(userWakeDir(), "hey-cinem.ppn");
  fs.copyFileSync(sourcePath, dest);
  return { ok: true, path: dest };
}

module.exports = {
  WAKE_FRAME_LENGTH,
  WAKE_SAMPLE_RATE,
  engineStatus,
  startWakeWord,
  stopWakeWord,
  setDeepSleep,
  installWakeModel,
  userWakeDir,
};
