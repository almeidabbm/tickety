const { contextBridge, ipcRenderer } = require("electron");

const call = async (channel, ...args) => {
  const { state, error } = await ipcRenderer.invoke(channel, ...args);
  if (error) throw new Error(error);
  return state;
};

contextBridge.exposeInMainWorld("tickety", {
  getState: () => call("tickety:get"),
  next: () => call("tickety:next"),
  back: () => call("tickety:back"),
  setTicket: (n) => call("tickety:set", n),
  setSound: (on) => call("tickety:sound", on),
  addPhotos: (files) => call("tickety:add", files),
  removePhoto: (name) => call("tickety:remove", name),
  reorderPhotos: (names) => call("tickety:reorder", names),
  openAdmin: () => {
    ipcRenderer.send("tickety:open-admin");
  },
  getUpdate: () => ipcRenderer.invoke("tickety:update-status"),
  checkUpdate: () => {
    ipcRenderer.send("tickety:update-check");
  },
  installUpdate: () => {
    ipcRenderer.send("tickety:update-install");
  },
  openDownload: () => {
    ipcRenderer.send("tickety:update-download");
  },
  onUpdate: (cb) => {
    const listener = (_event, status) => cb(status);
    ipcRenderer.on("tickety:update", listener);
    return () => ipcRenderer.removeListener("tickety:update", listener);
  },
  onState: (cb) => {
    const listener = (_event, payload) => cb(payload);
    ipcRenderer.on("tickety:state", listener);
    return () => ipcRenderer.removeListener("tickety:state", listener);
  },
});
