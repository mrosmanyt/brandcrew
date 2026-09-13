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
  windowMinimize() {
    ipcRenderer.send("cinem:window-min");
  },
  windowMaximize() {
    ipcRenderer.send("cinem:window-max");
  },
  windowClose() {
    ipcRenderer.send("cinem:window-close");
  },
  windowState() {
    return ipcRenderer.invoke("cinem:window-state");
  },
  onWindowState(handler) {
    if (typeof handler !== "function") return () => undefined;
    const listen = (_event, state) => handler(state);
    ipcRenderer.on("cinem:window-state", listen);
    return () => ipcRenderer.removeListener("cinem:window-state", listen);
  },
  onMode(handler) {
    if (typeof handler !== "function") return () => undefined;
    const listen = (_event, mode) => handler(mode);
    ipcRenderer.on("cinem:mode", listen);
    return () => ipcRenderer.removeListener("cinem:mode", listen);
  },
});
