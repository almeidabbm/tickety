const MAX_TICKET_NUM = 99;
let ticket = 1;
let loadedBackgrounds = [];

utils.fetchBackgrounds().then((bgs) => {
  loadedBackgrounds = bgs;
});

const ticketNumber = document.getElementById("ticketNumber");
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
  const currentBackgroundEl = document.getElementById("backgroundOverlay");

  if (currentBackgroundEl && currentBackgroundEl.src) {
    const backgroundParts = currentBackgroundEl.src.split("/");
    const currentBackground = backgroundParts[backgroundParts.length - 1];

    if (loadedBackgrounds.length > 0) {
      let currentBackgroundIndex = loadedBackgrounds.indexOf(currentBackground);

      // reset the index if we're on the last background
      currentBackgroundIndex = currentBackgroundIndex >= loadedBackgrounds.length - 1 ? 0 : currentBackgroundIndex + 1;

      backgroundParts[backgroundParts.length - 1] = loadedBackgrounds[currentBackgroundIndex];
      document.getElementById("backgroundOverlay").src = backgroundParts.join("/");
    }
  }
}

document.addEventListener("keydown", ({ key }) => {
  if (key === "Enter") {
    nextTicket();
  }
});
