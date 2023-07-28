const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("utils", {
  fetchBackgrounds: () => ipcRenderer.invoke("backgrounds"),
});
