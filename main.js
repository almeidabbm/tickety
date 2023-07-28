const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const electronReload = require("electron-reload");
electronReload(__dirname);

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preloaders", "preloader.js"),
    },
  });

  win.loadFile(path.join(__dirname, "app", "index.html"));
};

app.whenReady().then(() => {
  ipcMain.handle("backgrounds", () => {
    const backgrounds = fs.readdirSync(path.join(__dirname, "assets", "images"));
    return backgrounds;
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
