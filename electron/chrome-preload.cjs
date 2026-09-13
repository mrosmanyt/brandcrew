const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cinemChrome", {
  setMode(mode) {
    ipcRenderer.send("cinem:set-mode", mode);
  },
  openBoth() {
    ipcRenderer.send("cinem:open-both");
  },
  openUpdates() {
    ipcRenderer.send("cinem:open-updates");
  },
  onMode(handler) {
    if (typeof handler !== "function") return () => undefined;
    const listen = (_event, mode) => handler(mode);
    ipcRenderer.on("cinem:mode", listen);
    return () => ipcRenderer.removeListener("cinem:mode", listen);
  },
});
