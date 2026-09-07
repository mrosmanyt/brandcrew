const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("brandcrewDesktop", {
  desktop: true,
});
