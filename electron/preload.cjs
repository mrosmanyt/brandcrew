const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("brandcrewDesktop", {
  desktop: true,
  shell: "cinem-pro",
  retryDesk() {
    ipcRenderer.send("cinem:retry-desk");
  },
  openDeskInBrowser() {
    ipcRenderer.send("cinem:open-desk-external");
  },
  openAssistant() {
    ipcRenderer.send("cinem:set-mode", "assistant");
  },
  startCinemSignIn() {
    return ipcRenderer.invoke("cinem:start-sign-in");
  },
  onSession(handler) {
    if (typeof handler !== "function") return () => undefined;
    const listen = (_event, payload) => handler(payload);
    ipcRenderer.on("cinem:session", listen);
    return () => ipcRenderer.removeListener("cinem:session", listen);
  },
});
