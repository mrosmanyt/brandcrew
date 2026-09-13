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
  setMode(mode) {
    ipcRenderer.send("cinem:set-mode", mode);
  },
  openDesk() {
    ipcRenderer.send("cinem:set-mode", "desk");
  },
});
