const MAX_TICKET_NUM = 99;
let ticket = 1;
let loadedBackgrounds = [];

utils.fetchBackgrounds().then((bgs) => {
  loadedBackgrounds = bgs;
});

const ticketNumber = document.getElementById("ticketNumber");
ticketNumber.innerText = ticket;

function getActiveBackgroundImg() {
  return document.querySelector("img.backgroundOverlay:not([hidden])");
}

function getHiddenBackgroundImg() {
  return document.querySelector("img.backgroundOverlay[hidden]");
}

function toggleImageEl(newBackground) {
  const hiddenImgEl = getHiddenBackgroundImg();
  const activeImgEl = getActiveBackgroundImg();

  if (hiddenImgEl && activeImgEl) {
    // Setting the hidden to be shown
    hiddenImgEl.src = newBackground;
    hiddenImgEl.removeAttribute("hidden");

    // Setting the shown to be hidden
    activeImgEl.setAttribute("hidden", true);
  }
}

function changeBackground() {
  const currentBackgroundEl = getActiveBackgroundImg();

  if (currentBackgroundEl && currentBackgroundEl.src) {
    const backgroundParts = currentBackgroundEl.src.split("/");
    const currentBackground = backgroundParts[backgroundParts.length - 1];

    if (loadedBackgrounds.length > 0) {
      let currentBackgroundIndex = loadedBackgrounds.indexOf(currentBackground);

      // reset the index if we're on the last background
      currentBackgroundIndex = currentBackgroundIndex >= loadedBackgrounds.length - 1 ? 0 : currentBackgroundIndex + 1;

      backgroundParts[backgroundParts.length - 1] = loadedBackgrounds[currentBackgroundIndex];
      toggleImageEl(backgroundParts.join("/"));
    }
  }
}

function nextTicket() {
  if (ticket >= MAX_TICKET_NUM) {
    ticket = 1;
  } else {
    ticket++;
  }

  changeBackground();
  ticketNumber.innerText = ticket;
}

document.addEventListener("keydown", ({ key }) => {
  if (key === "Enter") {
    nextTicket();
  }
});
