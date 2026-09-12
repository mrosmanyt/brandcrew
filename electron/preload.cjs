const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("brandcrewDesktop", {
  desktop: true,
  retryDesk() {
    ipcRenderer.send("cinem:retry-desk");
  },
  openDeskInBrowser() {
    ipcRenderer.send("cinem:open-desk-external");
  },
});
