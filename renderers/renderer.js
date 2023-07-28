const ticketNumber = document.getElementById("ticketNumber");
const MAX_TICKET_NUM = 9;
let ticket = 1;

ticketNumber.innerText = ticket;

function nextTicket() {
  if (ticket >= MAX_TICKET_NUM) {
    ticket = 1;
  } else {
    ticket++;
  }

  changeBackground();
  ticketNumber.innerText = ticket;
}

function changeBackground() {
  const currentBg = document.getElementById("backgroundOverlay");

  if (currentBg && currentBg.src) {
    const bgParts = currentBg.src.split("/");
    const currentBackground = bgParts[bgParts.length - 1];

    const newBackground = loadedBackgrounds.find((bg) => bg != currentBackground);
    bgParts[bgParts.length - 1] = newBackground;
    document.getElementById("backgroundOverlay").src = bgParts.join("/");
  }
}

document.addEventListener("keydown", ({ key }) => {
  if (key === "Enter") {
    nextTicket();
  }
});
