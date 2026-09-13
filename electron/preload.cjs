const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("brandcrewDesktop", {
  desktop: true,
  retryDesk() {
    ipcRenderer.send("cinem:retry-desk");
  },
  openDeskInBrowser() {
    ipcRenderer.send("cinem:open-desk-external");
  },
  openAssistant() {
    ipcRenderer.send("cinem:set-mode", "assistant");
  },
});
