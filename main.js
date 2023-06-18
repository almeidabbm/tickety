const { app, BrowserWindow } = require("electron");
const MAX_TICKET_NUM = 99;

let ticket = 0;

function nextTicket() {
  if (ticket >= MAX_TICKET_NUM) {
    ticket = 0;
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
});
