const { app, BrowserWindow } = require("electron");
const electronReload = require("electron-reload");
electronReload(__dirname);

const MAX_TICKET_NUM = 9;

let ticket = 0;

function nextTicket() {
  if (ticket >= MAX_TICKET_NUM) {
    ticket = 1;
  } else {
    ticket++;
  }

  return ticket;
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
  });

  win.webContents.on("before-input-event", (e, i) => {
    if (i.key === "Enter" && i.type === "keyDown") {
      const currentTicket = nextTicket();
      console.log(`Current ticket is ${currentTicket}`);
    }
  });

  win.loadFile("index.html");
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
