const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cinemUpdates", {
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
});
