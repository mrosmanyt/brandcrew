const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cinemModeChooser", {
  choose(mode) {
    ipcRenderer.send("cinem:mode-chooser-pick", mode);
  },
});
