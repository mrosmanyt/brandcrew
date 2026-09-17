const { contextBridge, ipcRenderer } = require("electron");

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
