const { contextBridge, ipcRenderer } = require("electron");

/** Inlined from desk-shell.cjs — sandboxed preloads cannot require sibling .cjs files. */
function launchEnvEnabled(env, key) {
  const v = String(env[key] || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function packagedLaunchFlags(env = process.env) {
  return {
    computerUse: launchEnvEnabled(env, "COMPUTER_USE_ENABLED"),
    multilayer: launchEnvEnabled(env, "MULTILAYER_ORCHESTRATOR_ENABLED"),
    socialPlaybooks: launchEnvEnabled(env, "SOCIAL_CHROME_PLAYBOOKS_ENABLED"),
    remoteControl: launchEnvEnabled(env, "REMOTE_PHONE_CONTROL_ENABLED"),
  };
}

async function safeInvoke(channel, payload) {
  try {
    return await ipcRenderer.invoke(channel, payload);
  } catch (error) {
    console.error("[cinemDesktop]", channel, error);
    return { ok: false, error: "ipc_failed" };
  }
}

contextBridge.exposeInMainWorld("cinemDesktop", {
  desktop: true,
  shell: "cinem-pro",
  async openExternal(url) {
    return ipcRenderer.invoke("cinem:open-external", url);
  },
  async verifyShell(nonce) {
    return ipcRenderer.invoke("cinem:verify-shell", nonce);
  },
  async ping() {
    return ipcRenderer.invoke("cinem:ping");
  },
  async getStoredSession() {
    return ipcRenderer.invoke("cinem:get-session");
  },
  async storeSession(session) {
    return ipcRenderer.invoke("cinem:store-session", session || {});
  },
  onSession(handler) {
    if (typeof handler !== "function") return () => undefined;
    const listen = (_event, payload) => handler(payload);
    ipcRenderer.on("cinem:session", listen);
    return () => ipcRenderer.removeListener("cinem:session", listen);
  },
  async httpGet(url, opts) {
    return ipcRenderer.invoke("cinem:http-get", {
      url,
      worldMonitorKey: opts && opts.worldMonitorKey ? String(opts.worldMonitorKey) : "",
    });
  },
  setMode(mode) {
    ipcRenderer.send("cinem:set-mode", mode);
  },
  openDesk() {
    ipcRenderer.send("cinem:set-mode", "desk");
  },
  retryAssistant() {
    ipcRenderer.send("cinem:retry-assistant");
  },
  openUpdates() {
    ipcRenderer.send("cinem:open-updates");
  },
  getVoiceEnv() {
    return {
      FISH_AUDIO_API_KEY: String(
        process.env.FISH_AUDIO_API_KEY || process.env.FISH_API_KEY || "",
      ).trim(),
      DEEPGRAM_API_KEY: String(process.env.DEEPGRAM_API_KEY || "").trim(),
    };
  },
  getFeatureFlags() {
    return packagedLaunchFlags(process.env);
  },
  wakeWord: {
    async status() {
      return ipcRenderer.invoke("cinem:wake-word:status");
    },
    async start() {
      return ipcRenderer.invoke("cinem:wake-word:start");
    },
    async stop() {
      return ipcRenderer.invoke("cinem:wake-word:stop");
    },
    async setDeepSleep(on) {
      return ipcRenderer.invoke("cinem:wake-word:deep-sleep", Boolean(on));
    },
    onDetected(handler) {
      if (typeof handler !== "function") return () => undefined;
      const listen = (_event, payload) => handler(payload || {});
      ipcRenderer.on("cinem:wake-word", listen);
      return () => ipcRenderer.removeListener("cinem:wake-word", listen);
    },
    async installModel(sourcePath) {
      return ipcRenderer.invoke("cinem:wake-word:install-model", sourcePath);
    },
  },
  systemMeters: {
    async read() {
      return ipcRenderer.invoke("cinem:system-meters");
    },
  },
  computerUse: {
    async envEnabled() {
      try {
        return await ipcRenderer.invoke("cinem:computer-use:env-enabled");
      } catch {
        return false;
      }
    },
    async startSidecar() {
      return safeInvoke("cinem:computer-use:start-sidecar");
    },
    async startSession(payload) {
      return safeInvoke("cinem:computer-use:start-session", payload || {});
    },
    async syncHud(payload) {
      return safeInvoke("cinem:computer-use:sync-hud", payload || {});
    },
    async terminate() {
      return safeInvoke("cinem:computer-use:terminate");
    },
    async stopSession() {
      return safeInvoke("cinem:computer-use:stop-session");
    },
    onMousePause(handler) {
      if (typeof handler !== "function") return () => undefined;
      const listen = () => handler();
      ipcRenderer.on("cinem:computer-use:mouse-pause", listen);
      return () => ipcRenderer.removeListener("cinem:computer-use:mouse-pause", listen);
    },
    onTerminated(handler) {
      if (typeof handler !== "function") return () => undefined;
      const listen = (_event, payload) => handler(payload || {});
      ipcRenderer.on("cinem:computer-use:terminated", listen);
      return () => ipcRenderer.removeListener("cinem:computer-use:terminated", listen);
    },
  },
  updates: {
    async getState() {
      return ipcRenderer.invoke("cinem:update:get");
    },
    async check(opts) {
      return ipcRenderer.invoke("cinem:update:check", opts || {});
    },
    async download() {
      return ipcRenderer.invoke("cinem:update:download");
    },
    async install() {
      return ipcRenderer.invoke("cinem:update:install");
    },
    async setAutoUpdate(enabled) {
      return ipcRenderer.invoke("cinem:update:set-auto", enabled);
    },
    onStatus(handler) {
      if (typeof handler !== "function") return () => undefined;
      const listen = (_event, payload) => handler(payload);
      ipcRenderer.on("cinem:update:status", listen);
      return () => ipcRenderer.removeListener("cinem:update:status", listen);
    },
  },
});
