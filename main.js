const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { openStore } = require("./main/store");
const { startUpdater } = require("./main/updater");

if (!app.isPackaged) require("electron-reload")(__dirname);

const preload = path.join(__dirname, "preloaders", "preloader.js");
let store;
let updater;
let displayWin = null;
let adminWin = null;

const toPublic = (state) => ({
  ...state,
  photos: state.photos.map((name) => ({ name, url: pathToFileURL(path.join(store.photosDir, name)).href })),
  sounds: state.sounds.map((name) => ({ name, url: pathToFileURL(path.join(store.soundsDir, name)).href })),
});

const broadcast = (reason, state) => {
  const payload = { state: toPublic(state), reason };
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send("tickety:state", payload);
};

// Renderers are untrusted: every handler validates its arguments and answers { state } or { error }.
const handle = (channel, reason, fn) =>
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      const state = await fn(...args);
      if (reason) broadcast(reason, state);
      return { state: toPublic(state) };
    } catch (error) {
      return { error: error.message };
    }
  });

const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};

const isFile = (file) =>
  file !== null &&
  typeof file === "object" &&
  typeof file.name === "string" &&
  (file.data instanceof ArrayBuffer || file.data instanceof Uint8Array);

// The windows only ever show the app's own pages: a dropped file or link must not replace them.
const lockNavigation = (win) => {
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
};

const handleShortcuts = (win) =>
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "," && (input.control || input.meta)) {
      event.preventDefault();
      openAdmin();
    } else if (input.key === "F11" && win === displayWin) {
      event.preventDefault();
      win.setFullScreen(!win.isFullScreen());
    }
  });

const createDisplayWindow = () => {
  displayWin = new BrowserWindow({
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: "#000000",
    webPreferences: { preload, autoplayPolicy: "no-user-gesture-required" },
  });
  displayWin.on("closed", () => {
    displayWin = null;
  });
  handleShortcuts(displayWin);
  lockNavigation(displayWin);
  displayWin.loadFile(path.join(__dirname, "app", "index.html"));
};

function openAdmin() {
  if (adminWin) {
    adminWin.show();
    adminWin.focus();
    return;
  }
  adminWin = new BrowserWindow({
    width: 1000,
    height: 760,
    title: "Tickety — Administração",
    autoHideMenuBar: true,
    // Child of the display so it shows over the fullscreen window; not fullscreenable, or macOS makes it fullscreen too.
    parent: displayWin ?? undefined,
    fullscreenable: false,
    webPreferences: { preload },
  });
  adminWin.on("closed", () => {
    adminWin = null;
  });
  handleShortcuts(adminWin);
  lockNavigation(adminWin);
  adminWin.loadFile(path.join(__dirname, "app", "admin.html"));
}

// Two copies would each keep their own ticket and overwrite each other's state.json.
const isFirstCopy = app.requestSingleInstanceLock();
if (!isFirstCopy) app.quit();

app.on("second-instance", () => {
  if (!displayWin) return;
  if (displayWin.isMinimized()) displayWin.restore();
  displayWin.focus();
});

app.whenReady().then(() => {
  if (!isFirstCopy) return;
  store = openStore({
    dir: app.getPath("userData"),
    seedDir: path.join(__dirname, "assets", "images"),
    trash: (file) => shell.trashItem(file),
  });

  handle("tickety:get", null, () => store.getState());
  handle("tickety:next", "next", () => store.next());
  handle("tickety:back", "back", () => store.back());
  handle("tickety:set", "set", (n) => {
    assert(typeof n === "number", "A senha tem de ser um número inteiro entre 1 e 99.");
    return store.setTicket(n);
  });
  handle("tickety:sound", "sound", (on) => {
    assert(typeof on === "boolean", "Valor de som inválido.");
    return store.setSound(on);
  });
  handle("tickety:business", "business", (name) => {
    assert(typeof name === "string", "Nome inválido.");
    return store.setBusiness(name);
  });
  handle("tickety:reorder", "photos", (names) => {
    assert(Array.isArray(names) && names.every((name) => typeof name === "string"), "Ordem inválida.");
    return store.reorderPhotos(names);
  });
  handle("tickety:remove", "photos", (name) => {
    assert(typeof name === "string", "Fotografia não encontrada.");
    return store.removePhoto(name);
  });
  // Uploads broadcast what was saved even when some files were refused, then report the refusals.
  const handleUpload = (channel, add) =>
    handle(channel, null, (files) => {
      assert(Array.isArray(files) && files.every(isFile), "Ficheiros inválidos.");
      const { state, refused } = add(files.map(({ name, data }) => ({ name, data: Buffer.from(data) })));
      if (refused.length < files.length) broadcast("photos", state);
      assert(refused.length === 0, `Não foi possível adicionar: ${refused.join(", ")}.`);
      return state;
    });
  handleUpload("tickety:add", store.addPhotos);
  handleUpload("tickety:add-sounds", store.addSounds);
  handle("tickety:remove-sound", "sound", (name) => {
    assert(typeof name === "string", "Som não encontrado.");
    return store.removeSound(name);
  });
  handle("tickety:chime", "sound", (name) => {
    assert(name === null || typeof name === "string", "Som não encontrado.");
    return store.setChime(name);
  });
  ipcMain.on("tickety:open-admin", () => openAdmin());
  updater = startUpdater((status) => {
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send("tickety:update", status);
  });
  ipcMain.handle("tickety:update-status", () => updater.getStatus());
  ipcMain.on("tickety:update-install", () => updater.install());
  ipcMain.on("tickety:update-check", () => updater.check());
  ipcMain.on("tickety:update-download", () => updater.openDownload());

  createDisplayWindow();

  app.on("activate", () => {
    if (!displayWin) createDisplayWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
